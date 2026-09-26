import { useCallback, useEffect, useState } from 'react';
import type { CharityPick } from '../domain/types';
import { useServices } from '../services/ServiceContext';
import type { OracleStep } from '../services/types';
import { useAppState } from '../state/AppStateContext';

/**
 * Picks this morning's charity the moment it's needed (fresh X read / questionnaire),
 * unless it was already picked earlier this session — it's only revealed once.
 */
export function useCharityReveal() {
  const { state, dispatch } = useAppState();
  const services = useServices();
  const existing = state.session?.pick ?? null;
  const [step, setStep] = useState<OracleStep | null>(existing ? null : 'fetching');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const source = state.beneficiary;

  useEffect(() => {
    if (existing || !source) return;
    let alive = true;
    services.charityOracle
      .pickCharity(source, (s) => alive && setStep(s))
      .then((pick: CharityPick) => {
        if (!alive) return;
        dispatch({ type: 'CHARITY_PICKED', pick });
        setStep(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Analysis failed');
        setStep(null);
      });
    return () => {
      alive = false;
    };
    // Run once per attempt; `existing` flips to the new pick when it lands.
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setStep('fetching');
    setAttempt((a) => a + 1);
  }, []);

  return { pick: existing, step, error, retry, missingSource: !source };
}
