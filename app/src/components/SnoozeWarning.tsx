import { formatClock } from '../domain/alarm';
import { formatMoney } from '../domain/money';
import type { SnoozeQuote } from '../domain/rules';
import type { CharityPick } from '../domain/types';

interface Props {
  quote: SnoozeQuote;
  escalating: boolean;
  wakeBy: string;
  /** This morning's charity, once revealed. Never shown before the reveal. */
  pick: CharityPick | null;
}

/** Explains what the next snooze costs. The 'last-free' variant is the warning ring. */
export function SnoozeWarning({ quote, escalating, wakeBy, pick }: Props) {
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
            Be up by <strong>{formatClock(wakeBy)}</strong>. After that every snooze costs money — starting at{' '}
            <strong>{formatMoney(quote.firstPenalty)}</strong>
            {escalating ? ' and doubling each time' : ''} — and it goes to a charity WakeStake picked for you. You’ll
            hate it.
          </p>
        </div>
      );
    case 'paid':
      return (
        <div className="snooze-warning snooze-warning-paid" role="alert">
          <div className="snooze-warning-title">💸 It’s past {formatClock(wakeBy)}</div>
          <p>
            Snoozing now costs <strong>{formatMoney(quote.penalty)}</strong>
            {pick ? (
              <>
                {' '}
                and goes to <strong>{pick.charity.name}</strong>.
              </>
            ) : (
              '. Snooze and we’ll tell you who gets it.'
            )}
          </p>
        </div>
      );
    case 'broke':
      return <p className="snooze-note text-danger">Stake is empty. You can’t even afford to snooze.</p>;
  }
}
