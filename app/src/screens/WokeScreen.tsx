import { Screen } from '../components/Screen';
import { Button, Stat } from '../components/ui';
import { WAKE_CHEERS, pick } from '../domain/copy';
import { formatMoney } from '../domain/money';
import { useNavigation } from '../navigation/Navigation';
import { useAppState } from '../state/AppStateContext';

export function WokeScreen({ lost, snoozes }: { lost: number; snoozes: number }) {
  const { state } = useAppState();
  const { reset } = useNavigation();
  const paid = lost > 0;
  const clean = !paid;

  return (
    <Screen footer={<Button size="lg" onClick={() => reset({ name: 'dashboard' })}>Back to dashboard</Button>}>
      <div className="woke-hero">
        <div className="woke-emoji" aria-hidden>
          {clean ? '🏆' : '🥱'}
        </div>
        <h2 className="title center">
          {snoozes === 0 ? 'You’re up.' : clean ? 'Up. Within the rules.' : 'Up. Eventually.'}
        </h2>
        <p className="muted center">
          {snoozes === 0
            ? pick(WAKE_CHEERS, String(state.stats.wakeCount))
            : clean
              ? `${snoozes} free snooze${snoozes === 1 ? '' : 's'} used. Nothing lost.`
            : `${snoozes} snooze${snoozes === 1 ? '' : 's'} cost you ${formatMoney(lost)} this morning.`}
        </p>
      </div>
      <div className="stat-grid">
        <Stat label="Streak" value={`${state.stats.streak}🔥`} tone={clean ? 'lime' : undefined} delta={clean ? '+1' : 'reset'} />
        <Stat label="Stake safe" value={formatMoney(state.balance)} />
        <Stat label="Best streak" value={state.stats.bestStreak} />
        <Stat label="Total lost" value={formatMoney(state.stats.totalLost)} tone={state.stats.totalLost ? 'danger' : undefined} />
      </div>
    </Screen>
  );
}
