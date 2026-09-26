import { Screen } from '../components/Screen';
import { Button, Card, Eyebrow, Stat } from '../components/ui';
import { formatMoney } from '../domain/money';
import { useNavigation } from '../navigation/Navigation';
import { useAppState } from '../state/AppStateContext';

const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Where the depressing numbers live, so the dashboard doesn't have to show them every morning. */
export function SettingsScreen() {
  const { state, dispatch } = useAppState();
  const { navigate, back, reset } = useNavigation();
  const { stats, history, wallet } = state;

  const resetDemo = () => {
    if (window.confirm('Wipe all demo data and start over?')) {
      dispatch({ type: 'RESET' });
      reset({ name: 'welcome' });
    }
  };

  return (
    <Screen onBack={back}>
      <Eyebrow>Settings</Eyebrow>
      <h2 className="title">The damage</h2>
      <p className="muted">You asked. Don’t say we didn’t warn you.</p>

      <div className="stat-grid">
        <Stat label="Total lost" value={formatMoney(stats.totalLost)} tone={stats.totalLost > 0 ? 'danger' : undefined} />
        <Stat label="Paid snoozes" value={history.length} />
      </div>

      {history.length > 0 ? (
        <section className="stack-sm">
          <h3 className="section-title">Hall of shame</h3>
          <ul className="history">
            {history.slice(0, 20).map((e) => (
              <li key={e.id}>
                <button type="button" className="history-row" onClick={() => navigate({ name: 'receipt', eventId: e.id })}>
                  <span className="history-icon" aria-hidden>
                    😴
                  </span>
                  <span className="grow">
                    <span className="history-title">Snooze #{e.receipt.snoozeNumber}</span>
                    <span className="muted small">
                      {new Date(e.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })} ·{' '}
                      {e.receipt.charityName}
                    </span>
                  </span>
                  <strong className="text-danger">−{formatMoney(e.penalty)}</strong>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : stats.totalLost === 0 ? (
        <p className="muted">Nothing lost yet. Keep it that way.</p>
      ) : null}

      {wallet ? (
        <Card className="wallet-card">
          <span className="wallet-dot" data-on />
          <div className="grow">
            <div className="wallet-title">{shortAddress(wallet.address)}</div>
            <div className="muted small">{wallet.network}</div>
          </div>
        </Card>
      ) : null}

      <Button variant="ghost" onClick={resetDemo}>
        ↺ Reset demo
      </Button>
    </Screen>
  );
}
