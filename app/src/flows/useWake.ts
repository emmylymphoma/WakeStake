import { useCallback } from 'react';
import { useNavigation } from '../navigation/Navigation';
import { useAppState } from '../state/AppStateContext';

/** Ends the current alarm session and shows the wake-up summary. Call only once the user is verified up. */
export function useCompleteWake() {
  const { state, dispatch } = useAppState();
  const { reset } = useNavigation();
  return useCallback(() => {
    const lost = state.session?.lost ?? 0;
    const snoozes = state.session?.snoozes ?? 0;
    dispatch({ type: 'WAKE' });
    reset({ name: 'woke', lost, snoozes });
  }, [state.session, dispatch, reset]);
}

/** "I'm up" — goes through the bathroom-QR scan when one is set up. */
export function useWake() {
  const { state } = useAppState();
  const { navigate } = useNavigation();
  const complete = useCompleteWake();
  const needsScan = state.wakeCode !== null;
  const wake = useCallback(() => (needsScan ? navigate({ name: 'scanWake' }) : complete()), [needsScan, navigate, complete]);
  return { wake, needsScan };
}
