import { dollars } from './money';
import type { AppState } from './types';

export function createInitialState(): AppState {
  return {
    version: 2,
    onboarded: false,
    profile: { displayName: '', handle: '' },
    wallet: null,
    stake: { amount: dollars(50), penaltyPerSnooze: dollars(5), escalating: true, allOrNothing: false },
    balance: 0,
    alarm: {
      wakeBy: '07:00',
      legalSnoozes: 2,
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      label: 'Rise & grind (or pay)',
    },
    beneficiary: null,
    wakeCode: null,
    stats: { snoozeCount: 0, totalLost: 0, streak: 0, bestStreak: 0, wakeCount: 0 },
    history: [],
    session: null,
  };
}
