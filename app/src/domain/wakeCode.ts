import type { WakeCode } from './types';

/** Everything WakeStake prints starts with this, so we can tell "wrong QR" from "not ours". */
export const WAKE_QR_PREFIX = 'wakestake:wake:v1:';

export function encodeWakeQr(code: WakeCode): string {
  return WAKE_QR_PREFIX + code.id;
}

export type WakeQrMatch = 'ok' | 'wrong-code' | 'not-wakestake';

/** Compares scanned QR text against the enrolled code. */
export function matchWakeQr(code: WakeCode, scanned: string): WakeQrMatch {
  const text = scanned.trim();
  if (!text.startsWith(WAKE_QR_PREFIX)) return 'not-wakestake';
  return text.slice(WAKE_QR_PREFIX.length) === code.id ? 'ok' : 'wrong-code';
}
