import { dollars } from './money';
import type { AppState } from './types';

export function createInitialState(): AppState {
  return {
    version: 1,
    onboarded: false,
    profile: { displayName: '', handle: '' },
    wallet: null,
    stake: { amount: dollars(50), penaltyPerSnooze: dollars(5), freeSnoozes: 2, escalating: true },
    balance: 0,
    alarm: {
      time: '07:00',
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      label: 'Rise & grind (or pay)',
      snoozeMinutes: 9,
    },
    charity: null,
    wakeCode: null,
    stats: { snoozeCount: 0, totalLost: 0, streak: 0, bestStreak: 0, wakeCount: 0 },
    history: [],
    session: null,
  };
}
