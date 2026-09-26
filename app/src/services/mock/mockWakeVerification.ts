import { matchWakeQr } from '../../domain/wakeCode';
import type { WakeVerificationService } from '../types';
import { delay, randomHex } from './util';

/** Local-only: the code is a random secret and verification is a string compare. */
export function createMockWakeVerificationService(latencyMs: number): WakeVerificationService {
  return {
    async enroll() {
      await delay(latencyMs);
      return { id: randomHex(16), createdAt: new Date().toISOString() };
    },
    async verify(code, scanned) {
      await delay(latencyMs);
      const match = matchWakeQr(code, scanned);
      return match === 'ok' ? { ok: true, verifiedAt: new Date().toISOString() } : { ok: false, reason: match };
    },
  };
}
