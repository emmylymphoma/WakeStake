import type { Cents } from './types';

export const dollars = (amount: number): Cents => Math.round(amount * 100);

export function formatMoney(cents: Cents, opts: { signed?: boolean } = {}): string {
  const abs = Math.abs(cents) / 100;
  const body = abs.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  if (opts.signed) return (cents < 0 ? '−' : '+') + body;
  return cents < 0 ? '−' + body : body;
}
