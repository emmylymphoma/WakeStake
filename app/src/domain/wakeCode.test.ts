import { describe, expect, it } from 'vitest';
import { encodeWakeQr, matchWakeQr } from './wakeCode';

const code = { id: 'abc123', createdAt: '2026-09-26T00:00:00.000Z' };

describe('matchWakeQr', () => {
  it('accepts the enrolled code (ignoring surrounding whitespace)', () => {
    expect(matchWakeQr(code, encodeWakeQr(code))).toBe('ok');
    expect(matchWakeQr(code, `  ${encodeWakeQr(code)}\n`)).toBe('ok');
  });

  it('rejects another WakeStake code', () => {
    expect(matchWakeQr(code, encodeWakeQr({ ...code, id: 'other' }))).toBe('wrong-code');
  });

  it('rejects random QR codes', () => {
    expect(matchWakeQr(code, 'https://example.com')).toBe('not-wakestake');
    expect(matchWakeQr(code, 'abc123')).toBe('not-wakestake');
  });
});
