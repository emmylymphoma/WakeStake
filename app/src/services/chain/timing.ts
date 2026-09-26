import { HOUR, TIMESTAMP_WINDOW_SECONDS } from '../../../../src/constants';

/**
 * The circuit can't read the clock, so every proof carries a [past, future] window
 * that the contract checks against block.timestamp. All values are unix seconds.
 */
const HALF_WINDOW = TIMESTAMP_WINDOW_SECONDS / 2n;

/**
 * "I'm up" only goes on-chain this close to the deadline. Earlier than that there's
 * nothing to prove yet: the stake just keeps waiting for the morning. Without this,
 * tapping "I'm up" at bedtime would roll the stake past tomorrow's alarm.
 */
export const WAKE_WINDOW_SECONDS = 3n * HOUR;

export type WithdrawPlan = { kind: 'prove'; pastTimestamp: bigint; futureTimestamp: bigint } | { kind: 'late' };

export type WakePlan = WithdrawPlan | { kind: 'too-early' };

/**
 * Cashing out is an on-time proof, allowed any time before the deadline. On time needs
 * futureTimestamp < deadline, so the window is cut short near the deadline.
 */
export function planWithdraw(now: bigint, deadline: bigint): WithdrawPlan {
  if (now >= deadline) return { kind: 'late' };
  const futureTimestamp = now + HALF_WINDOW < deadline ? now + HALF_WINDOW : deadline - 1n;
  return { kind: 'prove', pastTimestamp: now - HALF_WINDOW, futureTimestamp };
}

/** Same proof as a withdraw, but only worth sending close to the deadline. */
export function planWake(now: bigint, deadline: bigint): WakePlan {
  if (now < deadline && deadline - now > WAKE_WINDOW_SECONDS) return { kind: 'too-early' };
  return planWithdraw(now, deadline);
}

export type SlashPlan = { kind: 'prove'; pastTimestamp: bigint; futureTimestamp: bigint } | { kind: 'too-early' };

/** Late needs pastTimestamp > deadline, and pastTimestamp must already be in the past. */
export function planSlash(now: bigint, deadline: bigint): SlashPlan {
  if (now <= deadline) return { kind: 'too-early' };
  const pastTimestamp = now - HALF_WINDOW > deadline ? now - HALF_WINDOW : deadline + 1n;
  return { kind: 'prove', pastTimestamp, futureTimestamp: now + HALF_WINDOW };
}

export const toUnixSeconds = (date: Date) => BigInt(Math.floor(date.getTime() / 1000));
export const fromUnixSeconds = (seconds: bigint) => new Date(Number(seconds) * 1000);
