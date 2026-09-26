import { Screen } from '../components/Screen';
import { Button, Card, Stat } from '../components/ui';
import { PENALTY_ROASTS, pick } from '../domain/copy';
import { formatMoney } from '../domain/money';
import { nextPenalty } from '../domain/rules';
import { useWake } from '../flows/useWake';
import { useNavigation } from '../navigation/Navigation';
import { useAppState } from '../state/AppStateContext';
import { MissingEvent } from './MissingEvent';
import { useEvent } from './useEvent';

export function PenaltyScreen({ eventId }: { eventId: string }) {
  const { state } = useAppState();
  const { navigate, reset } = useNavigation();
  const { wake, needsScan } = useWake();
  const event = useEvent(eventId);
  if (!event) return <MissingEvent />;

  const { stats } = state;
  const upcoming = nextPenalty(state);

  return (
    <Screen
      tone="danger"
      footer={
        <>
          <Button size="lg" onClick={wake}>
            {needsScan ? 'Fine, I’m up · go scan' : 'Fine, I’m up'}
          </Button>
          <Button variant="ghost" onClick={() => reset({ name: 'snoozed' })}>
            Back to sleep for {state.alarm.snoozeMinutes} min (next: −{formatMoney(upcoming)})
          </Button>
        </>
      }
    >
      <div className="penalty-hero">
        <div className="penalty-eyebrow">SNOOZE DETECTED</div>
        <div className="penalty-amount">−{formatMoney(event.penalty)}</div>
        <p className="penalty-roast">{pick(PENALTY_ROASTS, event.id)}</p>
        <p className="muted small">
          Sent to <strong className="text">{event.receipt.charityName}</strong>. Non-refundable. Obviously.
        </p>
      </div>

      <div className="stat-grid">
        <Stat label="Stake left" value={formatMoney(state.balance)} delta={`−${formatMoney(event.penalty)}`} tone="danger" />
        <Stat label="Snoozes" value={stats.snoozeCount} delta="+1" />
        <Stat label="Total lost" value={formatMoney(stats.totalLost)} delta={`+${formatMoney(event.penalty)}`} tone="danger" />
        <Stat label="Streak" value="0 💀" delta="reset" />
      </div>

      <div className="stack-sm">
        <Card className="link-card">
          <button type="button" className="link-row" onClick={() => navigate({ name: 'receipt', eventId: event.id })}>
            <span aria-hidden>🧾</span>
            <span className="grow">
              <strong>Proof of Snooze</strong>
              <span className="muted small">Receipt {event.receipt.receiptId}</span>
            </span>
            <span aria-hidden>→</span>
          </button>
        </Card>
        <Card className="link-card">
          <button type="button" className="link-row" onClick={() => navigate({ name: 'shame', eventId: event.id })}>
            <span aria-hidden>📣</span>
            <span className="grow">
              <strong>Your public shame</strong>
              <span className="muted small">Preview the post going to @{state.profile.handle}</span>
            </span>
            <span aria-hidden>→</span>
          </button>
        </Card>
      </div>
    </Screen>
  );
}
