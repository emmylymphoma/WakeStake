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
  'wrong-code': 'That’s a WakeStake code, but not yours.',
  'not-wakestake': 'That’s not your bathroom QR code.',
};

export function ScanWakeScreen() {
  const { state } = useAppState();
  const services = useServices();
  const { back } = useNavigation();
  const { complete: completeWake, proving, error: wakeError } = useCompleteWake();
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
        await completeWake();
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
          state.demoControls ? (
            <Button variant="ghost" disabled={verifying || proving} onClick={() => handleScan(encodeWakeQr(code))}>
              Simulate scan (demo only)
            </Button>
          ) : null
        ) : (
          <Button loading={proving} onClick={completeWake}>
            I’m up
          </Button>
        )
      }
    >
      <Eyebrow>Alarm still ringing</Eyebrow>
      <h2 className="title">Scan your bathroom QR to stop the alarm.</h2>
      <p className="muted">It stops as soon as your code is in frame.</p>

      <QrScanner onResult={handleScan} disabled={verifying || proving} />

      <div role="status" aria-live="polite">
        {proving ? (
          <p className="scan-feedback">Proving you’re up on-chain…</p>
        ) : verifying ? (
          <p className="scan-feedback">Checking…</p>
        ) : null}
        {wakeError ? <p className="scan-feedback scan-feedback-bad">{wakeError}</p> : null}
        {rejection ? <p className="scan-feedback scan-feedback-bad">{rejection}</p> : null}
      </div>
    </Screen>
  );
}
