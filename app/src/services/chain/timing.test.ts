import { describe, expect, it } from 'vitest';
import { planSlash, planWake, planWithdraw, WAKE_WINDOW_SECONDS } from './timing';

const DEADLINE = 1_800_000_000n;

describe('planWithdraw', () => {
  it('is allowed long before the deadline, unlike a wake', () => {
    const now = DEADLINE - WAKE_WINDOW_SECONDS - 1n;
    expect(planWithdraw(now, DEADLINE)).toEqual({
      kind: 'prove',
      pastTimestamp: now - 300n,
      futureTimestamp: now + 300n,
    });
  });

  it('cuts the window short right before the deadline', () => {
    expect(planWithdraw(DEADLINE - 60n, DEADLINE)).toEqual({
      kind: 'prove',
      pastTimestamp: DEADLINE - 360n,
      futureTimestamp: DEADLINE - 1n,
    });
  });

  it('is late at or after the deadline', () => {
    expect(planWithdraw(DEADLINE, DEADLINE)).toEqual({ kind: 'late' });
    expect(planWithdraw(DEADLINE + 1n, DEADLINE)).toEqual({ kind: 'late' });
  });
});

describe('planWake', () => {
  it('uses the full ±5 min window well before the deadline', () => {
    expect(planWake(DEADLINE - 3600n, DEADLINE)).toEqual({
      kind: 'prove',
      pastTimestamp: DEADLINE - 3900n,
      futureTimestamp: DEADLINE - 3300n,
    });
  });

  it('cuts the window short right before the deadline', () => {
    const plan = planWake(DEADLINE - 60n, DEADLINE);
    expect(plan).toEqual({ kind: 'prove', pastTimestamp: DEADLINE - 360n, futureTimestamp: DEADLINE - 1n });
  });

  it('is late at or after the deadline', () => {
    expect(planWake(DEADLINE, DEADLINE)).toEqual({ kind: 'late' });
    expect(planWake(DEADLINE + 1n, DEADLINE)).toEqual({ kind: 'late' });
  });

  it('does nothing on-chain long before the deadline', () => {
    expect(planWake(DEADLINE - WAKE_WINDOW_SECONDS - 1n, DEADLINE)).toEqual({ kind: 'too-early' });
  });
});

describe('planSlash', () => {
  it('is impossible until the deadline has passed', () => {
    expect(planSlash(DEADLINE, DEADLINE)).toEqual({ kind: 'too-early' });
  });

  it('keeps pastTimestamp after the deadline right after it passes', () => {
    expect(planSlash(DEADLINE + 30n, DEADLINE)).toEqual({
      kind: 'prove',
      pastTimestamp: DEADLINE + 1n,
      futureTimestamp: DEADLINE + 330n,
    });
  });

  it('uses the full window long after the deadline', () => {
    expect(planSlash(DEADLINE + 3600n, DEADLINE)).toEqual({
      kind: 'prove',
      pastTimestamp: DEADLINE + 3300n,
      futureTimestamp: DEADLINE + 3900n,
    });
  });
});
