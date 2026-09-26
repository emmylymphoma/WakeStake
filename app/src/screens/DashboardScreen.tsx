import { Logo } from '../components/Logo';
import { Screen } from '../components/Screen';
import { SnoozeProgress } from '../components/SnoozeProgress';
import { Button, Card, Eyebrow, ProgressBar, Stat } from '../components/ui';
import { useNow } from '../components/useNow';
import { describeDays, firstRingTime, formatClock, formatCountdown, nextAlarmDate } from '../domain/alarm';
import { formatMoney } from '../domain/money';
import { quoteSnooze } from '../domain/rules';
import { routeAfterSnooze, snoozeButtonLabel } from '../flows/snoozeCopy';
import { useSnoozeFlow } from '../flows/useSnoozeFlow';
import { useLockStake } from '../flows/useLockStake';
import { useWake } from '../flows/useWake';
import { useWithdrawStake } from '../flows/useWithdrawStake';
import { useNavigation } from '../navigation/Navigation';
import { useAppState } from '../state/AppStateContext';

export function DashboardScreen() {
  const { state } = useAppState();
  const { navigate, reset } = useNavigation();
  const { snooze, step, error } = useSnoozeFlow();
  const { wake, needsScan } = useWake();
  const { lock, locking, error: lockError } = useLockStake();
  const { withdraw, withdrawing, error: withdrawError, result: withdrawn } = useWithdrawStake();
  const now = useNow(30_000);

  const { stats, stake, balance, alarm, beneficiary, session } = state;
  const next = nextAlarmDate(alarm, now);
  const broke = balance <= 0;
  const quote = quoteSnooze(state);
  const snoozedUntil = session?.snoozedUntil ? new Date(session.snoozedUntil) : null;
  const snoozing = snoozedUntil !== null && snoozedUntil > now;

  const simulateSnooze = async () => {
    const outcome = await snooze();
    if (outcome) reset(routeAfterSnooze(outcome));
  };

  return (
    <Screen
      topRight={
        <button
          type="button"
          className="icon-btn"
          onClick={() => navigate({ name: 'settings' })}
          aria-label="Settings"
          title="Settings"
        >
          ⚙️
        </button>
      }
    >
      <SnoozeProgress step={step} />
      <div className="dash-head">
        <Logo />
        <p className="muted">
          Morning{state.profile.displayName ? ', ' : ''}
          <strong className="text">{state.profile.displayName}</strong>.
        </p>
      </div>

      {broke ? (
        <Card tone="danger" className="stack-sm">
          <strong>{withdrawn ? 'Stake withdrawn.' : 'Your stake is used up.'}</strong>
          <span className="muted">
            {withdrawn?.amountLabel ? `${withdrawn.amountLabel} is back in your wallet. ` : ''}
            Nothing is at stake right now. Re-stake to put money behind your alarm again.
            {withdrawn?.explorerUrl ? (
              <>
                {' '}
                <a href={withdrawn.explorerUrl} target="_blank" rel="noreferrer">
                  View transaction
                </a>
              </>
            ) : null}
          </span>
          <Button variant="secondary" loading={locking} onClick={() => lock()}>
            Re-stake {formatMoney(stake.amount)}
          </Button>
          {lockError ? <p className="text-danger small">{lockError}</p> : null}
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
              : ' Time to get up.'}
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
          {stake.allOrNothing ? (
            <>
              Snoozing past {formatClock(alarm.wakeBy)} costs <strong className="text-danger">all of it</strong>
            </>
          ) : (
            <>
              Snoozing past {formatClock(alarm.wakeBy)} costs{' '}
              <strong className="text-danger">{formatMoney(stake.penaltyPerSnooze)}</strong>
              {stake.escalating ? ', doubling each time' : ' each'}
            </>
          )}
        </div>
        {!broke && state.wallet ? (
          <>
            <Button variant="secondary" loading={withdrawing} onClick={withdraw}>
              Cash out {formatMoney(balance)}
            </Button>
            {withdrawError ? <p className="text-danger small">{withdrawError}</p> : null}
          </>
        ) : null}
      </Card>

      <div className="stat-grid">
        <Stat label="Streak" value={`${stats.streak}🔥`} tone={stats.streak > 0 ? 'lime' : undefined} />
        <Stat label="Best streak" value={stats.bestStreak} />
        <Stat label="Snoozes" value={stats.snoozeCount} />
        <Stat label="Wake-ups" value={stats.wakeCount} />
      </div>

      <Card className="alarm-card">
        <div className="grow">
          <Eyebrow>Next alarm</Eyebrow>
          <div className="alarm-time">{formatClock(firstRingTime(alarm))}</div>
          <div className="muted small">
            Be up by <strong className="text">{formatClock(alarm.wakeBy)}</strong> · {alarm.legalSnoozes} legal snooze
            {alarm.legalSnoozes === 1 ? '' : 's'}
          </div>
          <div className="muted small">
            {describeDays(alarm.days)} · {alarm.label}
          </div>
        </div>
        <div className="alarm-countdown">
          <span className="muted small">in</span>
          <strong>{next ? formatCountdown(next.getTime() - now.getTime()) : '—'}</strong>
        </div>
      </Card>

      <Card className="link-card">
        <button type="button" className="link-row" onClick={() => navigate({ name: 'beneficiary', mode: 'manage' })}>
          <span aria-hidden>🔒</span>
          <span className="grow">
            <strong>Your charity: classified</strong>
            <span className="muted small">
              {beneficiary?.kind === 'x'
                ? `Picked from @${beneficiary.account.handle} on X, the moment you snooze late.`
                : beneficiary
                  ? 'Picked from your questionnaire, the moment you snooze late.'
                  : 'Not set up yet — tap to fix.'}
            </span>
          </span>
          <span aria-hidden>→</span>
        </button>
      </Card>

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
          <span className="muted">Without it, you can tap “I’m up” without leaving bed.</span>
          <Button variant="secondary" onClick={() => navigate({ name: 'wakeQr', mode: 'manage' })}>
            Set up bathroom QR
          </Button>
        </Card>
      )}

      {state.demoControls ? (
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
      ) : null}
    </Screen>
  );
}
