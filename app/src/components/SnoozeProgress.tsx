import { SNOOZE_STEP_LABELS, type SnoozeStep } from '../flows/useSnoozeFlow';

const ORDER: SnoozeStep[] = ['slashing', 'proving', 'writing'];

/** Full-screen overlay shown while the snooze flow talks to the services. */
export function SnoozeProgress({ step }: { step: SnoozeStep | null }) {
  if (!step) return null;
  const current = ORDER.indexOf(step);
  return (
    <div className="overlay" role="status" aria-live="polite">
      <div className="overlay-card">
        <div className="overlay-title">Processing…</div>
        <ul className="progress-steps">
          {ORDER.map((s, i) => (
            <li key={s} className={i < current ? 'done' : i === current ? 'active' : ''}>
              <span className="progress-step-icon" aria-hidden>
                {i < current ? '✓' : i === current ? <span className="spinner" /> : '·'}
              </span>
              {SNOOZE_STEP_LABELS[s]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
