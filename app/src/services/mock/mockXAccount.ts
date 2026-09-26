import type { XAccountService } from '../types';
import { delay } from './util';

export function createMockXAccountService(latencyMs: number): XAccountService {
  return {
    async connect(opts) {
      await delay(latencyMs);
      const handle = (opts?.handleHint ?? '').replace(/^@/, '').trim() || 'sleepyhead';
      return { handle, connectedAt: new Date().toISOString() };
    },
  };
}
