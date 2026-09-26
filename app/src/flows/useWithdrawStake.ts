import { useCallback, useState } from 'react';
import { formatMoney } from '../domain/money';
import type { TxResult } from '../domain/types';
import { useServices } from '../services/ServiceContext';
import { useAppState } from '../state/AppStateContext';

/**
 * Cashes the whole stake back out to the wallet. With a real stake this proves "on time" on-chain,
 * so it only works before the deadline: yes, you can dodge the alarm by withdrawing at 5am.
 */
export function useWithdrawStake() {
  const { state, dispatch } = useAppState();
  const services = useServices();
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TxResult | null>(null);

  const withdraw = useCallback(async (): Promise<boolean> => {
    const { wallet, balance } = state;
    if (!wallet || balance <= 0) return false;
    if (!window.confirm(`Withdraw ${formatMoney(balance)} back to your wallet? Nothing is at stake until you re-stake.`)) {
      return false;
    }
    setWithdrawing(true);
    setError(null);
    try {
      const tx = await services.stake.withdraw({ wallet });
      dispatch({ type: 'STAKE_WITHDRAWN' });
      setResult(tx);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t withdraw the stake');
      return false;
    } finally {
      setWithdrawing(false);
    }
  }, [state, services, dispatch]);

  return { withdraw, withdrawing, error, result };
}
