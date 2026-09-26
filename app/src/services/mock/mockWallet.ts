import type { WalletService } from '../types';
import { delay, MOCK_NETWORK, randomHex } from './util';

export function createMockWalletService(latencyMs: number): WalletService {
  return {
    async connect() {
      await delay(latencyMs);
      return { address: `0x${randomHex(20)}`, network: MOCK_NETWORK };
    },
  };
}
