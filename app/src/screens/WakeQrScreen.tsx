import { useEffect, useState } from 'react';
import { Screen } from '../components/Screen';
import { Button, Eyebrow } from '../components/ui';
import { encodeWakeQr } from '../domain/wakeCode';
import { qrToDataUrl } from '../lib/qr';
import { useNavigation } from '../navigation/Navigation';
import { useServices } from '../services/ServiceContext';
import { useAppState } from '../state/AppStateContext';

const STEPS = [
  'Print it (or download and print later).',
  'Stick it up in your bathroom, away from your bed.',
  'When the alarm rings, the only way to stop it is walking over and scanning it.',
];

export function WakeQrScreen({ mode }: { mode: 'onboarding' | 'manage' }) {
  const { state, dispatch } = useAppState();
  const services = useServices();
  const { back, reset } = useNavigation();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const code = state.wakeCode;

  // First visit: create a code.
  useEffect(() => {
    if (code) return;
    let alive = true;
    services.wakeVerification.enroll().then((wakeCode) => alive && dispatch({ type: 'SET_WAKE_CODE', wakeCode }));
    return () => {
      alive = false;
    };
  }, [code, services, dispatch]);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    qrToDataUrl(encodeWakeQr(code)).then((url) => alive && setDataUrl(url));
    return () => {
      alive = false;
    };
  }, [code]);

  const regenerate = async () => {
    if (!window.confirm('Generate a new code? Your printed one will stop working.')) return;
    setRegenerating(true);
    try {
      dispatch({ type: 'SET_WAKE_CODE', wakeCode: await services.wakeVerification.enroll() });
    } finally {
      setRegenerating(false);
    }
  };

  const finish = () => {
    if (mode === 'onboarding') dispatch({ type: 'COMPLETE_ONBOARDING' });
    reset({ name: 'dashboard' });
  };

  return (
    <Screen
      onBack={back}
      step={mode === 'onboarding' ? { current: 4, total: 4 } : undefined}
      footer={
        <Button size="lg" disabled={!code} onClick={finish}>
          {mode === 'onboarding' ? 'It’s up on the wall' : 'Done'}
        </Button>
      }
    >
      <Eyebrow>{mode === 'onboarding' ? 'Step 4 · Bathroom QR' : 'Bathroom QR'}</Eyebrow>
      <h2 className="title">Put this code up in your bathroom.</h2>

      <div className="qr-sheet" data-testid="wake-qr">
        <div className="qr-sheet-brand">WAKESTAKE</div>
        {dataUrl ? (
          <img src={dataUrl} alt="Your bathroom wake-up QR code" className="qr-sheet-img" />
        ) : (
          <div className="qr-sheet-img skeleton" aria-busy />
        )}
        <div className="qr-sheet-caption">Scan me to stop your alarm.</div>
        <div className="qr-sheet-sub">U Snooze U Lose.</div>
      </div>

      <div className="qr-actions">
        {dataUrl ? (
          <a className="btn btn-secondary btn-md btn-block" href={dataUrl} download="wakestake-bathroom-qr.png">
            <span>⬇ Download PNG</span>
          </a>
        ) : null}
        <Button variant="secondary" disabled={!dataUrl} onClick={() => window.print()}>
          🖨 Print
        </Button>
      </div>

      <ol className="how-list">
        {STEPS.map((s, i) => (
          <li key={s} className="how-item">
            <span className="how-icon" aria-hidden>
              {i + 1}
            </span>
            <span className="muted">{s}</span>
          </li>
        ))}
      </ol>

      {mode === 'manage' ? (
        <Button variant="ghost" loading={regenerating} onClick={regenerate}>
          Generate a new code
        </Button>
      ) : null}
    </Screen>
  );
}
