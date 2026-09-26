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

/** Where to go after tapping snooze: free → countdown, first illegal → charity reveal, paid → penalty. */
export function routeAfterSnooze(outcome: SnoozeOutcome): Route {
  switch (outcome.kind) {
    case 'paid':
      return { name: 'penalty', eventId: outcome.event.id };
    case 'needs-reveal':
      return { name: 'reveal' };
    case 'free':
      return { name: 'snoozed' };
  }
}
