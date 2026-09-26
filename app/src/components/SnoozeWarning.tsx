import { formatMoney } from '../domain/money';
import type { SnoozeQuote } from '../domain/rules';

/** Explains what the next snooze costs. The 'last-free' variant is the warning ring. */
export function SnoozeWarning({ quote, escalating }: { quote: SnoozeQuote; escalating: boolean }) {
  switch (quote.kind) {
    case 'free':
      return (
        <p className="snooze-note">
          Snoozing is free for now. <strong>{quote.freeLeftAfter}</strong> free snooze
          {quote.freeLeftAfter === 1 ? '' : 's'} left after this one.
        </p>
      );
    case 'last-free':
      return (
        <div className="snooze-warning" role="alert">
          <div className="snooze-warning-title">⚠️ Last free snooze</div>
          <p>
            If you’re not up when it rings again, every snooze costs money — starting at{' '}
            <strong>{formatMoney(quote.firstPenalty)}</strong>
            {escalating ? ' and doubling each time' : ''}.
          </p>
        </div>
      );
    case 'paid':
      return (
        <div className="snooze-warning snooze-warning-paid" role="alert">
          <div className="snooze-warning-title">💸 Free snoozes are gone</div>
          <p>
            Snoozing now costs <strong>{formatMoney(quote.penalty)}</strong>. We did warn you.
          </p>
        </div>
      );
    case 'broke':
      return <p className="snooze-note text-danger">Stake is empty. You can’t even afford to snooze.</p>;
  }
}
