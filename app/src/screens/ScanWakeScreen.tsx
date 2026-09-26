import { useState } from 'react';
import { QrScanner } from '../components/QrScanner';
import { Screen } from '../components/Screen';
import { Button, Eyebrow } from '../components/ui';
import { encodeWakeQr } from '../domain/wakeCode';
import { useCompleteWake } from '../flows/useWake';
import { useNavigation } from '../navigation/Navigation';
import { useServices } from '../services/ServiceContext';
import type { WakeVerification } from '../services/types';
import { useAppState } from '../state/AppStateContext';

const REJECTIONS: Record<Extract<WakeVerification, { ok: false }>['reason'], string> = {
  'wrong-code': 'That’s a WakeStake code, but not yours. Nice try.',
  'not-wakestake': 'That’s not your bathroom QR. Scanning the cereal box won’t work.',
};

export function ScanWakeScreen() {
  const { state } = useAppState();
  const services = useServices();
  const { back } = useNavigation();
  const completeWake = useCompleteWake();
  const [verifying, setVerifying] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const code = state.wakeCode;

  const handleScan = async (text: string) => {
    if (!code || verifying) return;
    setVerifying(true);
    setRejection(null);
    try {
      const result = await services.wakeVerification.verify(code, text);
      if (result.ok) {
        completeWake();
        return;
      }
      setRejection(REJECTIONS[result.reason]);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Screen
      tone="alarm"
      onBack={back}
      footer={
        code ? (
          <Button variant="ghost" disabled={verifying} onClick={() => handleScan(encodeWakeQr(code))}>
            Simulate scan (demo only)
          </Button>
        ) : (
          <Button onClick={completeWake}>I’m up</Button>
        )
      }
    >
      <Eyebrow>Alarm still ringing</Eyebrow>
      <h2 className="title">Prove it. Go scan your bathroom QR.</h2>
      <p className="muted">The alarm stops the moment your code is in frame. Not before.</p>

      <QrScanner onResult={handleScan} disabled={verifying} />

      <div role="status" aria-live="polite">
        {verifying ? <p className="scan-feedback">Checking…</p> : null}
        {rejection ? <p className="scan-feedback scan-feedback-bad">{rejection}</p> : null}
      </div>
    </Screen>
  );
}
