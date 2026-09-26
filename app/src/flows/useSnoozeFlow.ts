import { useCallback, useState } from 'react';
import { needsCharityReveal, quoteSnooze } from '../domain/rules';
import type { SnoozeEvent } from '../domain/types';
import { randomId } from '../lib/random';
import { useServices } from '../services/ServiceContext';
import { useAppState } from '../state/AppStateContext';

export type SnoozeStep = 'slashing' | 'proving' | 'writing';

export const SNOOZE_STEP_LABELS: Record<SnoozeStep, string> = {
  slashing: 'Slashing your stake',
  proving: 'Minting Proof of Snooze',
  writing: 'Writing your post',
};

export type SnoozeOutcome =
  | { kind: 'free' }
  /** First illegal snooze of the morning: pick + reveal the charity before charging. */
  | { kind: 'needs-reveal' }
  | { kind: 'paid'; event: SnoozeEvent };

/**
 * Orchestrates a snooze. Free snoozes are recorded straight away; paid ones go
 * slash stake → issue receipt → write shame post → record.
 * Pure state changes live in domain/rules; this hook only sequences the services.
 */
export function useSnoozeFlow() {
  const { state, dispatch } = useAppState();
  const services = useServices();
  const [step, setStep] = useState<SnoozeStep | null>(null);
  const [error, setError] = useState<string | null>(null);

  const snooze = useCallback(async (): Promise<SnoozeOutcome | null> => {
    const { wallet } = state;
    const charity = state.session?.pick?.charity;
    const quote = quoteSnooze(state);
    if (quote.kind === 'broke') return null;
    if (quote.kind === 'free' || quote.kind === 'last-free') {
      dispatch({ type: 'FREE_SNOOZE', at: new Date().toISOString() });
      return { kind: 'free' };
    }
    if (needsCharityReveal(state)) return { kind: 'needs-reveal' };
    const penalty = quote.penalty;
    if (!wallet || !charity) return null;

    setError(null);
    try {
      const at = new Date().toISOString();
      if (!state.session) dispatch({ type: 'ALARM_RING', at });
      const sessionSnoozeIndex = state.session?.snoozes ?? 0;
      const snoozeNumber = state.stats.snoozeCount + 1;

      setStep('slashing');
      const tx = await services.stake.slash({ wallet, amount: penalty, charity });

      setStep('proving');
      const receipt = await services.proof.issueReceipt({ tx, wallet, amount: penalty, charity, snoozeNumber, at });

      setStep('writing');
      const text = await services.copywriter.writeShamePost({
        displayName: state.profile.displayName,
        handle: state.profile.handle,
        penalty,
        amountLabel: tx.amountLabel,
        charityName: charity.name,
        sessionSnoozeIndex,
        stats: state.stats,
      });

      const event: SnoozeEvent = {
        id: randomId(),
        at,
        penalty,
        balanceAfter: state.balance - penalty,
        sessionSnoozeIndex,
        receipt,
        post: { author: state.profile, text, createdAt: at },
      };
      dispatch({ type: 'SNOOZE_RECORDED', event });
      return { kind: 'paid', event };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Snooze failed.');
      return null;
    } finally {
      setStep(null);
    }
  }, [state, services, dispatch]);

  return { snooze, step, busy: step !== null, error };
}
