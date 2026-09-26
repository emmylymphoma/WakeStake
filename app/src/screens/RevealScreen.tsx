import { Screen } from '../components/Screen';
import { SnoozeProgress } from '../components/SnoozeProgress';
import { Button, Eyebrow } from '../components/ui';
import { formatClock } from '../domain/alarm';
import { formatMoney } from '../domain/money';
import { nextPenalty } from '../domain/rules';
import { useCharityReveal } from '../flows/useCharityReveal';
import { routeAfterSnooze } from '../flows/snoozeCopy';
import { useSnoozeFlow } from '../flows/useSnoozeFlow';
import { useWake } from '../flows/useWake';
import { useNavigation } from '../navigation/Navigation';
import type { OracleStep } from '../services/types';
import { useAppState } from '../state/AppStateContext';

const ORDER: OracleStep[] = ['fetching', 'analyzing', 'matching'];

/** The one-time warning: analyse the user now, then show who gets the money before charging. */
export function RevealScreen() {
  const { state } = useAppState();
  const { reset, navigate } = useNavigation();
  const { pick, step, error, retry, missingSource } = useCharityReveal();
  const { snooze, step: snoozeStep } = useSnoozeFlow();
  const { wake, needsScan } = useWake();
  const penalty = nextPenalty(state);
  const viaX = state.beneficiary?.kind === 'x';

  const stepLabels: Record<OracleStep, string> = {
    fetching: viaX ? `Reading @${state.profile.handle}’s latest posts & likes` : 'Re-reading your questionnaire',
    analyzing: 'Working out what you’d hate funding most',
    matching: 'Matching it to a charity',
  };

  const snoozeAnyway = async () => {
    const outcome = await snooze();
    if (outcome) reset(routeAfterSnooze(outcome));
  };

  if (missingSource) {
    return (
      <Screen footer={<Button onClick={() => navigate({ name: 'beneficiary', mode: 'manage' })}>Set it up</Button>}>
        <h2 className="title">We don’t know you well enough to punish you yet.</h2>
        <p className="muted">Connect X or take the questionnaire first.</p>
      </Screen>
    );
  }

  return (
    <Screen
      tone="alarm"
      footer={
        pick ? (
          <>
            <Button size="lg" onClick={wake} disabled={snoozeStep !== null}>
              {needsScan ? 'Fine, I’m up · scan QR' : 'Fine, I’m up'}
            </Button>
            <Button size="lg" variant="danger" loading={snoozeStep !== null} onClick={snoozeAnyway}>
              Snooze anyway · −{formatMoney(penalty)}
            </Button>
          </>
        ) : error ? (
          <Button onClick={retry}>Try again</Button>
        ) : null
      }
    >
      <SnoozeProgress step={snoozeStep} />
      <Eyebrow>⚠️ One-time warning</Eyebrow>
      <h2 className="title">
        It’s past {formatClock(state.alarm.wakeBy)}. Before you snooze…
      </h2>

      {step ? (
        <ul className="progress-steps reveal-steps" role="status" aria-live="polite">
          {ORDER.map((s, i) => {
            const current = ORDER.indexOf(step);
            return (
              <li key={s} className={i < current ? 'done' : i === current ? 'active' : ''}>
                <span className="progress-step-icon" aria-hidden>
                  {i < current ? '✓' : i === current ? <span className="spinner" /> : '·'}
                </span>
                {stepLabels[s]}
              </li>
            );
          })}
        </ul>
      ) : null}

      {error ? <p className="text-danger">Couldn’t analyse you: {error}</p> : null}

      {pick ? (
        <>
          <p className="muted">
            Snooze now and <strong className="text-danger">{formatMoney(penalty)}</strong> goes to:
          </p>
          <div className="reveal-card" data-testid="revealed-charity">
            <span className="reveal-emoji" aria-hidden>
              {pick.charity.emoji}
            </span>
            <div className="reveal-name">{pick.charity.name}</div>
            <div className="muted">{pick.charity.tagline}</div>
          </div>
          <section className="stack-sm">
            <h3 className="section-title">Why this one</h3>
            <ul className="reveal-reasons">
              {pick.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
          <p className="fine-print">We only tell you this once. Every late snooze this morning goes here.</p>
        </>
      ) : null}
    </Screen>
  );
}
