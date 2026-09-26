import type { StakeService } from '../types';
import { delay, MOCK_NETWORK, randomHex } from './util';

export function createMockStakeService(latencyMs: number): StakeService {
  let block = 18_420_000 + Math.floor(Math.random() * 10_000);
  const tx = () => ({ txHash: `0x${randomHex(32)}`, blockNumber: ++block, network: MOCK_NETWORK });

  return {
    async deposit(_wallet, amount) {
      if (amount <= 0) throw new Error('Stake must be positive');
      await delay(latencyMs);
      return tx();
    },
    async slash({ amount }) {
      if (amount <= 0) throw new Error('Nothing to slash');
      await delay(latencyMs);
      return tx();
    },
  };
}
