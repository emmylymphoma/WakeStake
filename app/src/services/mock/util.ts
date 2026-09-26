export { randomHex } from '../../lib/random';

/** Fake network latency so loading states are visible in the demo. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const MOCK_NETWORK = 'Base Sepolia (mock)';
