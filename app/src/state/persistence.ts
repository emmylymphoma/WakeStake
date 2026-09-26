import { createInitialState } from '../domain/defaults';
import type { AppState } from '../domain/types';

const KEY = 'wakestake:v1';

/** Storage can be blocked (private mode, sandboxed iframes) — the app must still work. */
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== 1) return createInitialState();
    const defaults = createInitialState();
    // Shallow-merge nested objects too, so fields added later get defaults on old saves.
    return {
      ...defaults,
      ...parsed,
      stake: { ...defaults.stake, ...parsed.stake },
      stats: { ...defaults.stats, ...parsed.stats },
      session: parsed.session ? { ...parsed.session, snoozedUntil: parsed.session.snoozedUntil ?? null } : null,
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
