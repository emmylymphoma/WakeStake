import { useState } from 'react';
import { Screen } from '../components/Screen';
import { Button, Card, ChipGroup, Eyebrow, Toggle } from '../components/ui';
import { dollars, formatMoney } from '../domain/money';
import { MAX_ESCALATION_STEPS, quotePenalty } from '../domain/rules';
import type { Wallet } from '../domain/types';
import { useNavigation } from '../navigation/Navigation';
import { useServices } from '../services/ServiceContext';
import { useAppState } from '../state/AppStateContext';

const AMOUNTS = [10, 25, 50, 100].map((d) => ({
  value: dollars(d),
  label: `$${d}`,
  hint: d === 10 ? 'Coward' : d === 25 ? 'Casual' : d === 50 ? 'Serious' : 'Psycho',
}));
const PENALTIES = [1, 2, 5, 10].map((d) => ({ value: dollars(d), label: `$${d}` }));

const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function StakeSetupScreen() {
  const { state, dispatch } = useAppState();
  const services = useServices();
  const { navigate, back } = useNavigation();

  const [wallet, setWallet] = useState<Wallet | null>(state.wallet);
  const [amount, setAmount] = useState(state.stake.amount);
  const [penalty, setPenalty] = useState(state.stake.penaltyPerSnooze);
  const [escalating, setEscalating] = useState(state.stake.escalating);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // The WakeStake contract can't slash part of a stake: late means the whole thing goes.
  const allOrNothing = services.stake.penaltyModel === 'all-or-nothing';
  const effectivePenalty = Math.min(penalty, amount);
  const stake = { amount, penaltyPerSnooze: effectivePenalty, escalating, allOrNothing };
  // Paid snoozes only — legal snoozes are set with the alarm.
  const ladder = Array.from({ length: 4 }, (_, i) => quotePenalty(stake, amount, i, 0));

  const connect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      setWallet(await services.wallet.connect());
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Couldn’t connect the wallet');
    } finally {
      setConnecting(false);
    }
  };

  // The deposit itself happens once the alarm is set: the stake is locked until your wake-by time.
  const next = () => {
    if (!wallet) return;
    dispatch({ type: 'SET_STAKE', stake, wallet });
    navigate({ name: 'alarmSetup' });
  };

  return (
    <Screen
      onBack={back}
      step={{ current: 1, total: 4 }}
      footer={
        wallet ? (
          <Button size="lg" onClick={next}>
            Stake {formatMoney(amount)}
          </Button>
        ) : (
          <Button size="lg" loading={connecting} onClick={connect}>
            Connect wallet
          </Button>
        )
      }
    >
      <Eyebrow>Step 1 · The stake</Eyebrow>
      <h2 className="title">How much is your sleep worth?</h2>
      <p className="muted">Pick an amount that would genuinely annoy you to lose. That’s the point.</p>

      <Card className="wallet-card">
        <span className="wallet-dot" data-on={Boolean(wallet)} />
        <div className="grow">
          <div className="wallet-title">{wallet ? shortAddress(wallet.address) : 'No wallet connected'}</div>
          <div className="muted small">
            {wallet
              ? wallet.network
              : allOrNothing
                ? 'Real transactions, your own wallet'
                : 'Mock wallet, no real funds'}
          </div>
        </div>
        {wallet ? <span className="pill pill-lime">Connected</span> : null}
      </Card>
      {connectError ? <p className="text-danger small">{connectError}</p> : null}

      <section className="stack-sm">
        <h3 className="section-title">Stake amount</h3>
        <ChipGroup label="Stake amount" options={AMOUNTS} value={amount} onChange={setAmount} />
      </section>

      {allOrNothing ? (
        <Card tone="danger" className="stack-sm">
          <strong>All or nothing.</strong>
          <span className="muted">
            Your stake is locked in the WakeStake contract until your wake-up time. Scan your bathroom QR before it and
            you keep it. Snooze past it and the whole {formatMoney(amount)} goes to charity (minus a 10% fee).
          </span>
        </Card>
      ) : (
        <>
          <section className="stack-sm">
            <h3 className="section-title">Penalty per late snooze</h3>
            <ChipGroup label="Penalty per late snooze" options={PENALTIES} value={penalty} onChange={setPenalty} />
          </section>

          <Card>
            <Toggle
              checked={escalating}
              onChange={setEscalating}
              label="Double or nothing"
              description={`Each extra paid snooze in the same morning doubles the penalty (up to ${2 ** MAX_ESCALATION_STEPS}×).`}
            />
            <div className="ladder" aria-label="Penalty per snooze">
              {ladder.map((p, i) => (
                <div key={i} className="ladder-step">
                  <span className="muted small">Late #{i + 1}</span>
                  <strong className="text-danger">−{formatMoney(p)}</strong>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </Screen>
  );
}
