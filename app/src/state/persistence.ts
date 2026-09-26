import { createInitialState } from '../domain/defaults';
import type { AppState } from '../domain/types';

/**
 * Bumped whenever the saved shape changes incompatibly; old demo data is discarded.
 * Each chain gets its own key, so a mock-demo save (fake wallet, fake stake) never shows up in chain mode.
 */
const chain = (import.meta.env as Record<string, string | undefined>).VITE_CHAIN;
const KEY = chain ? `wakestake:v2:${chain}` : 'wakestake:v2';

/** Storage can be blocked (private mode, sandboxed iframes) — the app must still work. */
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== 2) return createInitialState();
    const defaults = createInitialState();
    // Shallow-merge nested objects too, so fields added later get defaults on old saves.
    return {
      ...defaults,
      ...parsed,
      stake: { ...defaults.stake, ...parsed.stake },
      alarm: { ...defaults.alarm, ...parsed.alarm },
      stats: { ...defaults.stats, ...parsed.stats },
    } as AppState;
  } catch {
    return createInitialState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* non-fatal: demo just won't survive a reload */
  }
}
