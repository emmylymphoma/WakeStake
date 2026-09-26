import { useEffect } from 'react';
import { Screen } from '../components/Screen';
import { SnoozeWarning } from '../components/SnoozeWarning';
import { Button, Eyebrow } from '../components/ui';
import { useNow } from '../components/useNow';
import { quoteSnooze } from '../domain/rules';
import { useWake } from '../flows/useWake';
import { useNavigation } from '../navigation/Navigation';
import { useAppState } from '../state/AppStateContext';

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Alarm is quiet until `session.snoozedUntil`, then rings again on its own. */
export function SnoozedScreen() {
  const { state } = useAppState();
  const { reset } = useNavigation();
  const { wake, needsScan } = useWake();
  const now = useNow(250);

  const until = state.session?.snoozedUntil ? new Date(state.session.snoozedUntil) : null;
  const remaining = until ? until.getTime() - now.getTime() : 0;
  const ringAgain = () => reset({ name: 'alarm' });

  const active = state.session !== null;
  useEffect(() => {
    if (!active) reset({ name: 'dashboard' });
    else if (remaining <= 0) reset({ name: 'alarm' });
  }, [active, remaining, reset]);

  const quote = quoteSnooze(state);
  const snoozes = state.session?.snoozes ?? 0;

  return (
    <Screen
      footer={
        <>
          <Button size="lg" onClick={wake}>
            {needsScan ? 'Actually, I’m up · scan QR' : 'Actually, I’m up'}
          </Button>
          <Button variant="ghost" onClick={ringAgain}>
            Skip ahead · ring now (demo)
          </Button>
        </>
      }
    >
      <div className="snoozed-hero">
        <Eyebrow>Snoozed · #{snoozes} this morning</Eyebrow>
        <div className="snoozed-emoji" aria-hidden>
          😴
        </div>
        <div className="snoozed-countdown" aria-label="Time until the alarm rings again">
          {formatRemaining(remaining)}
        </div>
        <p className="muted center">
          Rings again at {until?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) ?? '—'}.
        </p>
      </div>
      <div className="stack-sm">
        <h3 className="section-title">When it rings again</h3>
        <SnoozeWarning quote={quote} escalating={state.stake.escalating} />
      </div>
    </Screen>
  );
}
