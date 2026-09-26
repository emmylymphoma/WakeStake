import { Logo } from '../components/Logo';
import { Screen } from '../components/Screen';
import { SnoozeProgress } from '../components/SnoozeProgress';
import { Button, Card, Eyebrow, ProgressBar, Stat } from '../components/ui';
import { useNow } from '../components/useNow';
import { describeDays, formatClock, formatCountdown, nextAlarmDate } from '../domain/alarm';
import { formatMoney } from '../domain/money';
import { quoteSnooze } from '../domain/rules';
import { routeAfterSnooze, snoozeButtonLabel } from '../flows/snoozeCopy';
import { useSnoozeFlow } from '../flows/useSnoozeFlow';
import { useWake } from '../flows/useWake';
import { useNavigation } from '../navigation/Navigation';
import { useAppState } from '../state/AppStateContext';

export function DashboardScreen() {
  const { state, dispatch } = useAppState();
  const { navigate, reset } = useNavigation();
  const { snooze, step, error } = useSnoozeFlow();
  const { wake, needsScan } = useWake();
  const now = useNow(30_000);

  const { stats, stake, balance, alarm, charity, session } = state;
  const next = nextAlarmDate(alarm, now);
  const broke = balance <= 0;
  const quote = quoteSnooze(state);
  const snoozedUntil = session?.snoozedUntil ? new Date(session.snoozedUntil) : null;
  const snoozing = snoozedUntil !== null && snoozedUntil > now;

  const simulateSnooze = async () => {
    const outcome = await snooze();
    if (outcome) reset(routeAfterSnooze(outcome));
  };

  const resetDemo = () => {
    if (window.confirm('Wipe all demo data and start over?')) {
      dispatch({ type: 'RESET' });
      reset({ name: 'welcome' });
    }
  };

  return (
    <Screen
      topRight={
        <button type="button" className="icon-btn" onClick={resetDemo} aria-label="Reset demo" title="Reset demo">
          ↺
        </button>
      }
    >
      <SnoozeProgress step={step} />
      <div className="dash-head">
        <Logo />
        <p className="muted">
          Morning, <strong className="text">{state.profile.displayName || 'sleepyhead'}</strong>. Don’t make this weird.
        </p>
      </div>

      {broke ? (
        <Card tone="danger" className="stack-sm">
          <strong>💀 Stake wiped out.</strong>
          <span className="muted">Your alarm has no teeth. Re-stake to make mornings dangerous again.</span>
          <Button variant="secondary" onClick={() => dispatch({ type: 'RESTAKE' })}>
            Re-stake {formatMoney(stake.amount)}
          </Button>
        </Card>
      ) : null}

      {session ? (
        <Card tone="danger" className="stack-sm">
          <strong>{snoozing ? '😴 Snoozing.' : '⏰ Alarm still going.'}</strong>
          <span className="muted">
            Snoozed {session.snoozes}× this morning
            {session.lost > 0 ? ` (${formatMoney(session.lost)} gone)` : ' (free so far)'}.
            {snoozing
              ? ` Rings again at ${snoozedUntil.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
              : ' Get up already.'}
          </span>
          <Button variant="secondary" onClick={() => navigate({ name: snoozing ? 'snoozed' : 'alarm' })}>
            {snoozing ? 'View snooze timer' : 'Back to the alarm'}
          </Button>
          <Button variant="primary" onClick={wake}>
            {needsScan ? 'Fine, I’m up · go scan' : 'Fine, I’m up'}
          </Button>
        </Card>
      ) : null}

      <Card className="stake-card">
        <Eyebrow>Stake at risk</Eyebrow>
        <div className="stake-amount">
          {formatMoney(balance)}
          <span className="muted"> / {formatMoney(stake.amount)}</span>
        </div>
        <ProgressBar value={balance} max={stake.amount} tone={balance / stake.amount < 0.34 ? 'danger' : 'lime'} />
        <div className="muted small">
          {stake.freeSnoozes > 0 ? `${stake.freeSnoozes} free snooze${stake.freeSnoozes === 1 ? '' : 's'}, then ` : 'Every snooze costs '}
          <strong className="text-danger">{formatMoney(stake.penaltyPerSnooze)}</strong>
          {stake.escalating ? ' · doubling each time' : ' each'}
        </div>
      </Card>

      <div className="stat-grid">
        <Stat label="Streak" value={`${stats.streak}🔥`} tone={stats.streak > 0 ? 'lime' : undefined} />
        <Stat label="Snoozes" value={stats.snoozeCount} />
        <Stat label="Total lost" value={formatMoney(stats.totalLost)} tone={stats.totalLost > 0 ? 'danger' : undefined} />
        <Stat label="Best streak" value={stats.bestStreak} />
      </div>

      <Card className="alarm-card">
        <div className="grow">
          <Eyebrow>Next alarm</Eyebrow>
          <div className="alarm-time">{formatClock(alarm.time)}</div>
          <div className="muted small">
            {describeDays(alarm.days)} · {alarm.label}
          </div>
        </div>
        <div className="alarm-countdown">
          <span className="muted small">in</span>
          <strong>{next ? formatCountdown(next.getTime() - now.getTime()) : '—'}</strong>
        </div>
      </Card>

      {charity ? (
        <Card className="charity-mini">
          <span className="charity-emoji" aria-hidden>
            {charity.emoji}
          </span>
          <div className="grow">
            <div className="muted small">Your snoozes fund</div>
            <strong>{charity.name}</strong>
          </div>
          <strong className="text-lime">{formatMoney(stats.totalLost)}</strong>
        </Card>
      ) : null}

      {state.wakeCode ? (
        <Card className="link-card">
          <button type="button" className="link-row" onClick={() => navigate({ name: 'wakeQr', mode: 'manage' })}>
            <span aria-hidden>🚽</span>
            <span className="grow">
              <strong>Bathroom QR armed</strong>
              <span className="muted small">Only scanning it stops the alarm. Tap to reprint.</span>
            </span>
            <span aria-hidden>→</span>
          </button>
        </Card>
      ) : (
        <Card tone="danger" className="stack-sm">
          <strong>🛏️ No bathroom QR yet.</strong>
          <span className="muted">Right now you can tap “I’m up” without leaving bed. That’s a loophole.</span>
          <Button variant="secondary" onClick={() => navigate({ name: 'wakeQr', mode: 'manage' })}>
            Set up bathroom QR
          </Button>
        </Card>
      )}

      <section className="demo-panel stack-sm">
        <div className="demo-panel-head">
          <Eyebrow>Demo controls</Eyebrow>
        </div>
        <Button variant="secondary" onClick={() => navigate({ name: 'alarm' })}>
          ⏰ Ring alarm now
        </Button>
        <Button
          variant={quote.kind === 'free' ? 'secondary' : 'danger'}
          disabled={quote.kind === 'broke' || step !== null}
          onClick={simulateSnooze}
        >
          😴 {snoozeButtonLabel(quote, 'Simulate Snooze')}
        </Button>
        {error ? <p className="text-danger small">{error}</p> : null}
      </section>

      {state.history.length > 0 ? (
        <section className="stack-sm">
          <h3 className="section-title">Hall of shame</h3>
          <ul className="history">
            {state.history.slice(0, 8).map((e) => (
              <li key={e.id}>
                <button type="button" className="history-row" onClick={() => navigate({ name: 'receipt', eventId: e.id })}>
                  <span className="history-icon" aria-hidden>
                    😴
                  </span>
                  <span className="grow">
                    <span className="history-title">Snooze #{e.receipt.snoozeNumber}</span>
                    <span className="muted small">
                      {new Date(e.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </span>
                  <strong className="text-danger">−{formatMoney(e.penalty)}</strong>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Screen>
  );
}
