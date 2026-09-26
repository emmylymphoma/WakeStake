import { describe, expect, it } from 'vitest';
import { createInitialState } from './defaults';
import { dollars, formatMoney } from './money';
import {
  applyCharityPick,
  applyFreeSnooze,
  applyRestake,
  applySnooze,
  applyWake,
  needsCharityReveal,
  quotePenalty,
  quoteSnooze,
  startSession,
} from './rules';
import type { AppState, SnoozeEvent } from './types';

function armed(overrides: Partial<AppState> = {}): AppState {
  const s = createInitialState();
  return { ...s, onboarded: true, balance: s.stake.amount, ...overrides };
}

const AT = '2026-09-26T07:00:00.000Z';

function snoozeEvent(penalty: number, balanceAfter: number, index = 0): SnoozeEvent {
  const at = AT;
  return {
    id: `e${index}`,
    at,
    penalty,
    balanceAfter,
    sessionSnoozeIndex: index,
    receipt: {
      receiptId: 'POS-1',
      txHash: '0x',
      blockNumber: 1,
      network: 'mock',
      issuedAt: at,
      amount: penalty,
      charityId: 'c',
      charityName: 'C',
      walletAddress: '0x',
      snoozeNumber: index + 1,
      proofHash: '0x',
    },
    post: { author: { displayName: 'A', handle: 'a' }, text: 't', createdAt: at },
  };
}

describe('quotePenalty', () => {
  const stake = { amount: dollars(50), penaltyPerSnooze: dollars(5), escalating: true };

  it('doubles per paid snooze when escalating', () => {
    expect([0, 1, 2, 3].map((i) => quotePenalty(stake, dollars(1000), i, 0))).toEqual([5, 10, 20, 40].map(dollars));
  });

  it('is free for the legal snoozes, then escalates from the first paid one', () => {
    expect([0, 1, 2, 3, 4].map((i) => quotePenalty(stake, dollars(1000), i, 2))).toEqual([0, 0, 5, 10, 20].map(dollars));
  });

  it('is flat when not escalating', () => {
    expect(quotePenalty({ ...stake, escalating: false }, dollars(50), 4, 0)).toBe(dollars(5));
  });

  it('never exceeds the remaining balance', () => {
    expect(quotePenalty(stake, dollars(3), 0, 0)).toBe(dollars(3));
    expect(quotePenalty(stake, 0, 0, 0)).toBe(0);
  });

  it('caps escalation', () => {
    expect(quotePenalty(stake, dollars(10_000), 50, 0)).toBe(dollars(5 * 32));
  });
});

describe('quoteSnooze (warning ring)', () => {
  const withSnoozes = (legalSnoozes: number, snoozes: number, balance = dollars(50)) => {
    const s = armed({ balance });
    return {
      ...s,
      alarm: { ...s.alarm, legalSnoozes },
      session: { startedAt: 'a', snoozes, lost: 0, snoozedUntil: null, pick: null },
    };
  };

  it('walks free → last-free (warning) → paid', () => {
    expect(quoteSnooze(withSnoozes(2, 0))).toEqual({ kind: 'free', freeLeftAfter: 1, firstPenalty: dollars(5) });
    expect(quoteSnooze(withSnoozes(2, 1))).toEqual({ kind: 'last-free', firstPenalty: dollars(5) });
    expect(quoteSnooze(withSnoozes(2, 2))).toEqual({ kind: 'paid', penalty: dollars(5) });
    expect(quoteSnooze(withSnoozes(2, 3))).toEqual({ kind: 'paid', penalty: dollars(10) });
  });

  it('warns on the very first ring when there is exactly one legal snooze', () => {
    expect(quoteSnooze(withSnoozes(1, 0)).kind).toBe('last-free');
  });

  it('charges immediately with zero legal snoozes', () => {
    expect(quoteSnooze(withSnoozes(0, 0))).toEqual({ kind: 'paid', penalty: dollars(5) });
  });

  it('allows legal snoozes with an empty stake, but not paid ones', () => {
    expect(quoteSnooze(withSnoozes(2, 0, 0)).kind).toBe('free');
    expect(quoteSnooze(withSnoozes(2, 2, 0)).kind).toBe('broke');
  });
});

describe('needsCharityReveal / applyCharityPick', () => {
  const pick = {
    charity: { id: 'c', name: 'Friends of Mondays', tagline: '', emoji: '📅', category: '' },
    basis: 'questionnaire' as const,
    reasons: [],
    analyzedAt: AT,
  };

  it('is needed only at the first paid snooze, and only once per morning', () => {
    let s = startSession(armed(), AT); // 2 legal snoozes by default
    expect(needsCharityReveal(s)).toBe(false);
    s = applyFreeSnooze(applyFreeSnooze(s, AT), AT);
    expect(needsCharityReveal(s)).toBe(true);
    s = applyCharityPick(s, pick);
    expect(needsCharityReveal(s)).toBe(false);
    s = applySnooze(s, snoozeEvent(dollars(5), dollars(45), 2));
    expect(needsCharityReveal(s)).toBe(false);
    expect(s.session?.pick).toEqual(pick);
  });

  it('is forgotten after waking up — tomorrow gets a fresh analysis', () => {
    const s = applyCharityPick(startSession(armed(), AT), pick);
    expect(startSession(applyWake(s), AT).session?.pick).toBeNull();
  });
});

describe('applyFreeSnooze', () => {
  it('counts the snooze, keeps money and streak, and re-rings in 5 minutes', () => {
    const before = armed({ stats: { snoozeCount: 0, totalLost: 0, streak: 3, bestStreak: 3, wakeCount: 3 } });
    const after = applyFreeSnooze(startSession(before, AT), AT);
    expect(after.balance).toBe(before.balance);
    expect(after.stats).toMatchObject({ snoozeCount: 1, totalLost: 0, streak: 3 });
    expect(after.session).toMatchObject({ snoozes: 1, lost: 0, snoozedUntil: '2026-09-26T07:05:00.000Z' });
  });
});

describe('applySnooze (paid)', () => {
  it('updates stake, snooze count, total lost, kills the streak and snoozes the alarm', () => {
    const before = armed({ stats: { snoozeCount: 2, totalLost: dollars(7), streak: 4, bestStreak: 6, wakeCount: 9 } });
    const after = applySnooze(startSession(before, AT), snoozeEvent(dollars(5), dollars(45)));

    expect(after.balance).toBe(dollars(45));
    expect(after.stats).toMatchObject({ snoozeCount: 3, totalLost: dollars(12), streak: 0, bestStreak: 6 });
    expect(after.session).toMatchObject({ snoozes: 1, lost: dollars(5), snoozedUntil: '2026-09-26T07:05:00.000Z' });
    expect(after.history).toHaveLength(1);
  });

  it('opens a session if none exists', () => {
    const after = applySnooze(armed(), snoozeEvent(dollars(5), dollars(45)));
    expect(after.session?.snoozes).toBe(1);
  });
});

describe('applyWake', () => {
  const streak2 = { snoozeCount: 0, totalLost: 0, streak: 2, bestStreak: 2, wakeCount: 2 };

  it('extends the streak on a clean wake-up', () => {
    const after = applyWake(startSession(armed({ stats: streak2 }), AT));
    expect(after.stats).toMatchObject({ streak: 3, bestStreak: 3, wakeCount: 3 });
    expect(after.session).toBeNull();
  });

  it('still extends the streak after only free snoozes', () => {
    const s = applyFreeSnooze(applyFreeSnooze(startSession(armed({ stats: streak2 }), AT), AT), AT);
    expect(applyWake(s).stats.streak).toBe(3);
  });

  it('keeps the streak at zero after a paid snooze', () => {
    const snoozed = applySnooze(startSession(armed(), AT), snoozeEvent(dollars(5), dollars(45)));
    expect(applyWake(snoozed).stats.streak).toBe(0);
  });
});

describe('startSession / applyRestake', () => {
  it('keeps an in-progress session but clears the snooze timer when it rings again', () => {
    const s = applySnooze(startSession(armed(), AT), snoozeEvent(dollars(5), dollars(45)));
    expect(startSession(s, 'b').session).toEqual({ ...s.session, snoozedUntil: null });
  });

  it('restores the balance to the configured stake', () => {
    expect(applyRestake(armed({ balance: 0 })).balance).toBe(dollars(50));
  });
});

describe('formatMoney', () => {
  it('formats whole and fractional dollars', () => {
    expect(formatMoney(dollars(5))).toBe('$5');
    expect(formatMoney(dollars(2.5))).toBe('$2.50');
    expect(formatMoney(-dollars(5))).toBe('−$5');
  });
});
