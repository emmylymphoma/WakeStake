import { useEffect } from 'react';
import { Screen } from '../components/Screen';
import { SnoozeProgress } from '../components/SnoozeProgress';
import { SnoozeWarning } from '../components/SnoozeWarning';
import { Button } from '../components/ui';
import { useNow } from '../components/useNow';
import { formatMoney } from '../domain/money';
import { quoteSnooze } from '../domain/rules';
import { routeAfterSnooze, snoozeButtonLabel } from '../flows/snoozeCopy';
import { useSnoozeFlow } from '../flows/useSnoozeFlow';
import { useWake } from '../flows/useWake';
import { useNavigation } from '../navigation/Navigation';
import { useAppState } from '../state/AppStateContext';

export function AlarmScreen() {
  const { state, dispatch } = useAppState();
  const { reset } = useNavigation();
  const { snooze, step, error } = useSnoozeFlow();
  const { wake, needsScan } = useWake();
  const now = useNow();

  useEffect(() => {
    dispatch({ type: 'ALARM_RING', at: new Date().toISOString() });
  }, [dispatch]);

  const quote = quoteSnooze(state);
  const snoozes = state.session?.snoozes ?? 0;

  const onSnooze = async () => {
    const outcome = await snooze();
    if (outcome) reset(routeAfterSnooze(outcome));
  };

  return (
    <Screen
      tone={quote.kind === 'free' ? 'default' : 'alarm'}
      footer={
        <>
          <Button size="lg" onClick={wake} disabled={step !== null}>
            {needsScan ? 'I’M UP · scan bathroom QR' : 'I’M UP'}
          </Button>
          {quote.kind !== 'broke' ? (
            <Button
              size="lg"
              variant={quote.kind === 'free' ? 'secondary' : 'danger'}
              onClick={onSnooze}
              loading={step !== null}
            >
              {snoozeButtonLabel(quote)}
            </Button>
          ) : null}
          {error ? <p className="fine-print text-danger">{error}</p> : null}
        </>
      }
    >
      <SnoozeProgress step={step} />
      <div className="alarm-hero">
        <div className="ring" aria-hidden>
          <span />
          <span />
          <span className="ring-core">⏰</span>
        </div>
        <div className="alarm-clock">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
        <div className="alarm-label">{state.alarm.label}</div>
        <div className="alarm-stakes">
          <span className="pill pill-danger">{formatMoney(state.balance)} on the line</span>
          {snoozes > 0 ? <span className="pill">Snoozed {snoozes}× already</span> : null}
        </div>
      </div>
      <SnoozeWarning
          quote={quote}
          escalating={state.stake.escalating}
          wakeBy={state.alarm.wakeBy}
          pick={state.session?.pick ?? null}
        />
    </Screen>
  );
}
