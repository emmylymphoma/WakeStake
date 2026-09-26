import { formatMoney } from '../domain/money';
import type { SnoozeOutcome } from './useSnoozeFlow';
import type { SnoozeQuote } from '../domain/rules';
import type { Route } from '../navigation/Navigation';

/** Label for the snooze button, given what snoozing would cost right now. */
export function snoozeButtonLabel(quote: SnoozeQuote, prefix = 'Snooze'): string {
  switch (quote.kind) {
    case 'free':
      return `${prefix} · free (${quote.freeLeftAfter} left after)`;
    case 'last-free':
      return `${prefix} · last free one`;
    case 'paid':
      return `${prefix} · −${formatMoney(quote.penalty)}`;
    case 'broke':
      return `${prefix} · stake empty`;
  }
}

/** Where to go after a snooze: paid → penalty screen, free → snoozed countdown. */
export function routeAfterSnooze(outcome: SnoozeOutcome): Route {
  return outcome.kind === 'paid' ? { name: 'penalty', eventId: outcome.event.id } : { name: 'snoozed' };
}
