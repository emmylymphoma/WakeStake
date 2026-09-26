import { useCallback, useState } from 'react';
import { nextDeadline } from '../domain/alarm';
import { useNavigation } from '../navigation/Navigation';
import { useServices } from '../services/ServiceContext';
import { useAppState } from '../state/AppStateContext';

/**
 * Ends the current alarm session and shows the wake-up summary. Call only once the user is verified up.
 * With a real stake this first proves "up on time" on-chain, which rolls the stake to the next deadline.
 */
export function useCompleteWake() {
  const { state, dispatch } = useAppState();
  const services = useServices();
  const { reset } = useNavigation();
  const [proving, setProving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = useCallback(async () => {
    const { wallet, wakeCode, alarm } = state;
    if (wallet && wakeCode && state.balance > 0) {
      setProving(true);
      setError(null);
      try {
        await services.stake.wake({ wallet, wakeCode, nextDeadline: (after) => nextDeadline(alarm, after) });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Couldn’t prove you’re up');
        return;
      } finally {
        setProving(false);
      }
    }
    const lost = state.session?.lost ?? 0;
    const snoozes = state.session?.snoozes ?? 0;
    dispatch({ type: 'WAKE' });
    reset({ name: 'woke', lost, snoozes });
  }, [state, services, dispatch, reset]);

  return { complete, proving, error };
}

/** "I'm up" — goes through the bathroom-QR scan when one is set up. */
export function useWake() {
  const { state } = useAppState();
  const { navigate } = useNavigation();
  const { complete } = useCompleteWake();
  const needsScan = state.wakeCode !== null;
  const wake = useCallback(
    () => (needsScan ? navigate({ name: 'scanWake' }) : complete()),
    [needsScan, navigate, complete],
  );
  return { wake, needsScan };
}
