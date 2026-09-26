/** Brand voice. Kept in one place so tone can be tuned (or A/B tested) later. */

export const SLOGAN = 'U Snooze U Lose.';

export const PENALTY_ROASTS = [
  'Your pillow just invoiced you.',
  'Congrats, you’re a philanthropist now. Involuntarily.',
  'Bed: 1. You: 0.',
  'That snooze was sponsored by your wallet.',
  'Nine more minutes. Worth it? (No.)',
  'Your alarm is winning and it knows it.',
  'Somewhere, a charity just smiled because you’re weak.',
];

export const WAKE_CHEERS = [
  'Look at you. A functioning adult.',
  'Stake safe. Dignity intact.',
  'The bed lost this round.',
  'Your wallet thanks you.',
];

/** Deterministic pick so the same event always shows the same line. */
export function pick<T>(items: readonly T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const item = items[Math.abs(h) % items.length];
  if (item === undefined) throw new Error('pick() needs a non-empty list');
  return item;
}
