import type { AppState, Cents, SnoozeEvent, StakeConfig } from './types';

/** Escalation doubles the penalty per paid snooze, capped at 2^MAX_ESCALATION_STEPS. */
export const MAX_ESCALATION_STEPS = 5;

/**
 * Penalty for the snooze at `sessionSnoozes` (0-based) in the current session.
 * The first `freeSnoozes` are free; escalation counts from the first paid one.
 * Never more than what's left in the stake.
 */
export function quotePenalty(stake: StakeConfig, balance: Cents, sessionSnoozes: number): Cents {
  const paidIndex = sessionSnoozes - stake.freeSnoozes;
  if (paidIndex < 0) return 0;
  const steps = stake.escalating ? Math.min(paidIndex, MAX_ESCALATION_STEPS) : 0;
  return Math.max(0, Math.min(balance, stake.penaltyPerSnooze * 2 ** steps));
}

export type SnoozeQuote =
  /** Free, with more free snoozes after this one. */
  | { kind: 'free'; freeLeftAfter: number; firstPenalty: Cents }
  /** Free, but the next one costs money — this is the warning ring. */
  | { kind: 'last-free'; firstPenalty: Cents }
  | { kind: 'paid'; penalty: Cents }
  /** Paid window and the stake is empty. */
  | { kind: 'broke' };

/** What happens if the user snoozes right now. Drives all the alarm copy. */
export function quoteSnooze(state: AppState): SnoozeQuote {
  const { stake, balance } = state;
  const index = state.session?.snoozes ?? 0;
  const freeLeft = stake.freeSnoozes - index;
  const firstPenalty = Math.min(balance, stake.penaltyPerSnooze);
  if (freeLeft > 1) return { kind: 'free', freeLeftAfter: freeLeft - 1, firstPenalty };
  if (freeLeft === 1) return { kind: 'last-free', firstPenalty };
  const penalty = quotePenalty(stake, balance, index);
  return penalty > 0 ? { kind: 'paid', penalty } : { kind: 'broke' };
}

export function nextPenalty(state: AppState): Cents {
  return quotePenalty(state.stake, state.balance, state.session?.snoozes ?? 0);
}

export function canSnooze(state: AppState): boolean {
  return quoteSnooze(state).kind !== 'broke';
}

function snoozedUntil(state: AppState, at: string): string {
  return new Date(new Date(at).getTime() + state.alarm.snoozeMinutes * 60_000).toISOString();
}

/** Alarm (re)starts ringing. Keeps an in-progress session, but it's no longer snoozed. */
export function startSession(state: AppState, at: string): AppState {
  if (state.session) return { ...state, session: { ...state.session, snoozedUntil: null } };
  return { ...state, session: { startedAt: at, snoozes: 0, lost: 0, snoozedUntil: null } };
}

function sessionFor(state: AppState, at: string) {
  return state.session ?? { startedAt: at, snoozes: 0, lost: 0, snoozedUntil: null };
}

/** A snooze inside the free window: counts, but costs nothing and keeps the streak. */
export function applyFreeSnooze(state: AppState, at: string): AppState {
  const session = sessionFor(state, at);
  return {
    ...state,
    stats: { ...state.stats, snoozeCount: state.stats.snoozeCount + 1 },
    session: { ...session, snoozes: session.snoozes + 1, snoozedUntil: snoozedUntil(state, at) },
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
      snoozedUntil: snoozedUntil(state, event.at),
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

/** Top the stake back up to the configured amount. */
export function applyRestake(state: AppState): AppState {
  return { ...state, balance: state.stake.amount };
}
