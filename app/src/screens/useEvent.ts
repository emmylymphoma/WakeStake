import type { SnoozeEvent } from '../domain/types';
import { useAppState } from '../state/AppStateContext';

export function useEvent(eventId: string): SnoozeEvent | undefined {
  return useAppState().state.history.find((e) => e.id === eventId);
}
