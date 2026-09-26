import { SNOOZE_MINUTES } from './alarm';
import type { AppState, Cents, CharityPick, SnoozeEvent, StakeConfig } from './types';

/** Escalation doubles the penalty per paid snooze, capped at 2^MAX_ESCALATION_STEPS. */
export const MAX_ESCALATION_STEPS = 5;

/**
 * Penalty for the snooze at `sessionSnoozes` (0-based) in the current session.
 * The first `legalSnoozes` are free; escalation counts from the first paid one.
 * All-or-nothing stakes lose everything on the first paid snooze.
 * Never more than what's left in the stake.
 */
export function quotePenalty(stake: StakeConfig, balance: Cents, sessionSnoozes: number, legalSnoozes: number): Cents {
  const paidIndex = sessionSnoozes - legalSnoozes;
  if (paidIndex < 0) return 0;
  if (stake.allOrNothing) return Math.max(0, balance);
  const steps = stake.escalating ? Math.min(paidIndex, MAX_ESCALATION_STEPS) : 0;
  return Math.max(0, Math.min(balance, stake.penaltyPerSnooze * 2 ** steps));
}

export type SnoozeQuote =
  /** Free, with more free snoozes after this one. */
  | { kind: 'free'; freeLeftAfter: number; firstPenalty: Cents }
  /** Free, but the next one costs money — this is the warning ring (last ring before wake-by). */
  | { kind: 'last-free'; firstPenalty: Cents }
  | { kind: 'paid'; penalty: Cents }
  /** Paid window and the stake is empty. */
  | { kind: 'broke' };

/** What happens if the user snoozes right now. Drives all the alarm copy. */
export function quoteSnooze(state: AppState): SnoozeQuote {
  const { stake, balance } = state;
  const index = state.session?.snoozes ?? 0;
  const freeLeft = state.alarm.legalSnoozes - index;
  const firstPenalty = stake.allOrNothing ? balance : Math.min(balance, stake.penaltyPerSnooze);
  if (freeLeft > 1) return { kind: 'free', freeLeftAfter: freeLeft - 1, firstPenalty };
  if (freeLeft === 1) return { kind: 'last-free', firstPenalty };
  const penalty = quotePenalty(stake, balance, index, state.alarm.legalSnoozes);
  return penalty > 0 ? { kind: 'paid', penalty } : { kind: 'broke' };
}

export function nextPenalty(state: AppState): Cents {
  return quotePenalty(state.stake, state.balance, state.session?.snoozes ?? 0, state.alarm.legalSnoozes);
}

/**
 * The next snooze is paid but this morning's charity hasn't been picked yet:
 * analyse now, and show the one-time warning before charging.
 */
export function needsCharityReveal(state: AppState): boolean {
  return quoteSnooze(state).kind === 'paid' && !state.session?.pick;
}

export function canSnooze(state: AppState): boolean {
  return quoteSnooze(state).kind !== 'broke';
}

function snoozedUntil(at: string): string {
  return new Date(new Date(at).getTime() + SNOOZE_MINUTES * 60_000).toISOString();
}

/** Alarm (re)starts ringing. Keeps an in-progress session, but it's no longer snoozed. */
export function startSession(state: AppState, at: string): AppState {
  if (state.session) return { ...state, session: { ...state.session, snoozedUntil: null } };
  return { ...state, session: newSession(at) };
}

function newSession(at: string) {
  return { startedAt: at, snoozes: 0, lost: 0, snoozedUntil: null, pick: null };
}

function sessionFor(state: AppState, at: string) {
  return state.session ?? newSession(at);
}

/** Locks in this morning's charity. Picked once per session, then reused for every paid snooze. */
export function applyCharityPick(state: AppState, pick: CharityPick): AppState {
  const session = sessionFor(state, pick.analyzedAt);
  return { ...state, session: { ...session, pick } };
}

/** A snooze inside the free window: counts, but costs nothing and keeps the streak. */
export function applyFreeSnooze(state: AppState, at: string): AppState {
  const session = sessionFor(state, at);
  return {
    ...state,
    stats: { ...state.stats, snoozeCount: state.stats.snoozeCount + 1 },
    session: { ...session, snoozes: session.snoozes + 1, snoozedUntil: snoozedUntil(at) },
  };
}

/** Records a paid snooze: drains the stake, bumps counters and kills the streak. */
export function applySnooze(state: AppState, event: SnoozeEvent): AppState {
  const session = sessionFor(state, event.at);
  return {
    ...state,
    balance: Math.max(0, state.balance - event.penalty),
    stats: {
      ...state.stats,
      snoozeCount: state.stats.snoozeCount + 1,
      totalLost: state.stats.totalLost + event.penalty,
      streak: 0,
    },
    history: [event, ...state.history],
    session: {
      ...session,
      snoozes: session.snoozes + 1,
      lost: session.lost + event.penalty,
      snoozedUntil: snoozedUntil(event.at),
    },
  };
}

/** User got up. Extends the streak unless they paid for a snooze this session. */
export function applyWake(state: AppState): AppState {
  const paid = (state.session?.lost ?? 0) > 0;
  const streak = paid ? 0 : state.stats.streak + 1;
  return {
    ...state,
    stats: {
      ...state.stats,
      streak,
      bestStreak: Math.max(state.stats.bestStreak, streak),
      wakeCount: state.stats.wakeCount + 1,
    },
    session: null,
  };
}

/** The stake was (re)deposited: back up to the configured amount. */
export function applyRestake(state: AppState): AppState {
  return { ...state, balance: state.stake.amount };
}
