import { useState } from 'react';
import { Screen } from '../components/Screen';
import { XConnectSheet } from '../components/XConnectSheet';
import { Button, Card, Eyebrow } from '../components/ui';
import { useNavigation } from '../navigation/Navigation';
import { useAppState } from '../state/AppStateContext';

export function BeneficiaryScreen({ mode }: { mode: 'onboarding' | 'manage' }) {
  const { state, dispatch } = useAppState();
  const { navigate, back } = useNavigation();
  const [connecting, setConnecting] = useState(false);
  const source = state.beneficiary;

  const next = () => (mode === 'onboarding' ? navigate({ name: 'wakeQr', mode: 'onboarding' }) : back());

  return (
    <Screen
      onBack={back}
      step={mode === 'onboarding' ? { current: 3, total: 4 } : undefined}
      footer={
        <Button size="lg" disabled={!source} onClick={next}>
          {mode === 'onboarding' ? 'Next: bathroom QR' : 'Done'}
        </Button>
      }
    >
      {connecting ? (
        <XConnectSheet
          onCancel={() => setConnecting(false)}
          onConnected={(account) => {
            dispatch({ type: 'SET_BENEFICIARY', beneficiary: { kind: 'x', account } });
            setConnecting(false);
          }}
        />
      ) : null}

      <Eyebrow>{mode === 'onboarding' ? 'Step 3 · The beneficiary' : 'The beneficiary'}</Eyebrow>
      <h2 className="title">Who gets your money? Not your call.</h2>
      <p className="muted">
        WakeStake picks a charity you’d <strong className="text">hate</strong> funding. You won’t know which one until the
        morning you snooze past your wake-up time. We check again right then, so it’s always up to date.
      </p>

      <Card className={`source-card ${source?.kind === 'x' ? 'source-card-on' : ''}`}>
        <div className="source-head">
          <span className="source-icon" aria-hidden>
            𝕏
          </span>
          <div className="grow">
            <strong>Connect X</strong>
            <span className="muted small">We read your posts, likes and follows at the moment you snooze late.</span>
          </div>
          <span className="pill pill-lime">Recommended</span>
        </div>
        {source?.kind === 'x' ? (
          <p className="source-status">✓ Connected as @{source.account.handle}</p>
        ) : (
          <Button variant="secondary" onClick={() => setConnecting(true)}>
            Connect X account
          </Button>
        )}
      </Card>

      <Card className={`source-card ${source?.kind === 'questionnaire' ? 'source-card-on' : ''}`}>
        <div className="source-head">
          <span className="source-icon" aria-hidden>
            📝
          </span>
          <div className="grow">
            <strong>No X? Take the questionnaire</strong>
            <span className="muted small">Six questions. We fund whatever you like least.</span>
          </div>
        </div>
        {source?.kind === 'questionnaire' ? (
          <p className="source-status">✓ Questionnaire done</p>
        ) : null}
        <Button variant="secondary" onClick={() => navigate({ name: 'questionnaire', mode })}>
          {source?.kind === 'questionnaire' ? 'Retake questionnaire' : source ? 'Use the questionnaire instead' : 'Take the questionnaire'}
        </Button>
      </Card>

      <p className="fine-print">You can’t choose or see the charity. That’s the point. 😈</p>
    </Screen>
  );
}
