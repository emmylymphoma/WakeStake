import { useCallback, useState } from 'react';
import { nextDeadline } from '../domain/alarm';
import type { AlarmConfig } from '../domain/types';
import { useServices } from '../services/ServiceContext';
import { useAppState } from '../state/AppStateContext';

/**
 * Deposits the configured stake until the next wake-by deadline. Needs the alarm (the
 * on-chain note commits to the deadline) and the bathroom code (its secret proves waking),
 * so the code is created here if it doesn't exist yet.
 */
export function useLockStake() {
  const { state, dispatch } = useAppState();
  const services = useServices();
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lock = useCallback(
    async (alarm: AlarmConfig = state.alarm): Promise<boolean> => {
      const { wallet } = state;
      const deadline = nextDeadline(alarm, new Date());
      if (!wallet || !deadline) return false;
      setLocking(true);
      setError(null);
      try {
        let wakeCode = state.wakeCode;
        if (!wakeCode) {
          wakeCode = await services.wakeVerification.enroll();
          dispatch({ type: 'SET_WAKE_CODE', wakeCode });
        }
        await services.stake.deposit({ wallet, amount: state.stake.amount, deadline, wakeCode });
        dispatch({ type: 'STAKE_LOCKED' });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Couldn’t lock the stake');
        return false;
      } finally {
        setLocking(false);
      }
    },
    [state, services, dispatch],
  );

  return { lock, locking, error };
}
