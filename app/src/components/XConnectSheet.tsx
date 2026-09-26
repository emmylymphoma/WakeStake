import { useState } from 'react';
import type { XAccount } from '../domain/types';
import { useServices } from '../services/ServiceContext';
import { Button, Field, MockBadge } from './ui';

const PERMISSIONS = [
  'Read your posts, likes and follows',
  'Post on your behalf (public shame, only after a late snooze)',
];

/** Stand-in for X's OAuth consent page. The real flow redirects to x.com and back. */
export function XConnectSheet({ onConnected, onCancel }: { onConnected: (a: XAccount) => void; onCancel: () => void }) {
  const services = useServices();
  const [handle, setHandle] = useState('');
  const [connecting, setConnecting] = useState(false);

  const authorize = async () => {
    setConnecting(true);
    try {
      onConnected(await services.xAccount.connect({ handleHint: handle }));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="x-sheet-title">
      <div className="overlay-card x-sheet">
        <div className="x-sheet-head">
          <span className="x-logo" aria-hidden>
            𝕏
          </span>
          <MockBadge>MOCK LOGIN</MockBadge>
        </div>
        <h3 id="x-sheet-title" className="overlay-title">
          WakeStake wants to access your X account
        </h3>
        <ul className="x-sheet-perms">
          {PERMISSIONS.map((p) => (
            <li key={p}>✓ {p}</li>
          ))}
        </ul>
        <Field label="X username (mock only — the real app uses X login)">
          <div className="input-prefix">
            <span>@</span>
            <input
              className="input"
              placeholder="snoozelord"
              value={handle}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>
        </Field>
        <div className="stack-sm">
          <Button loading={connecting} disabled={!handle.trim()} onClick={authorize}>
            Authorize app
          </Button>
          <Button variant="ghost" disabled={connecting} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
