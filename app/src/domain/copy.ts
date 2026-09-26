/** Brand voice. Kept in one place so tone can be tuned (or A/B tested) later. */

export const SLOGAN = 'U Snooze U Lose.';

export const PENALTY_ROASTS = [
  'That snooze wasn’t free.',
  'Bed 1, you 0.',
  'Five more minutes, paid in full.',
  'Your pillow just sent an invoice.',
];

export const WAKE_CHEERS = ['Stake safe.', 'Up on time.', 'The bed lost this round.', 'Good start to the day.'];

/** Deterministic pick so the same event always shows the same line. */
export function pick<T>(items: readonly T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const item = items[Math.abs(h) % items.length];
  if (item === undefined) throw new Error('pick() needs a non-empty list');
  return item;
}
