import { createMockCharityOracleService } from './mock/mockCharityOracle';
import { createMockCopywriterService } from './mock/mockCopywriter';
import { createMockProofService } from './mock/mockProof';
import { createMockSocialService } from './mock/mockSocial';
import { createMockStakeService } from './mock/mockStake';
import { createMockWakeVerificationService } from './mock/mockWakeVerification';
import { createMockWalletService } from './mock/mockWallet';
import { createMockXAccountService } from './mock/mockXAccount';
import type { Services } from './types';

/**
 * Composition root for services. To go live, replace individual entries with real
 * implementations — no screen needs to change. Wallet + stake already have one: see
 * createServices below.
 */
export function createMockServices({ latencyMs = 600 }: { latencyMs?: number } = {}): Services {
  return {
    wallet: createMockWalletService(latencyMs),
    stake: createMockStakeService(latencyMs),
    proof: createMockProofService(latencyMs),
    copywriter: createMockCopywriterService(latencyMs),
    social: createMockSocialService(latencyMs),
    xAccount: createMockXAccountService(latencyMs),
    charityOracle: createMockCharityOracleService(latencyMs),
    wakeVerification: createMockWakeVerificationService(latencyMs / 2),
  };
}

/**
 * Mocks, plus the real wallet + WakeStake contract when VITE_CHAIN is set (see .env.example).
 * The chain code is loaded lazily so the mock app and its tests never touch it.
 */
export async function createServices(): Promise<Services> {
  const mocks = createMockServices();
  const { readChainConfig } = await import('./chain/config');
  const chain = readChainConfig();
  if (!chain) return mocks;
  const { createChainStakeService, createInjectedWalletService } = await import('./chain/chainServices');
  return { ...mocks, wallet: createInjectedWalletService(chain), stake: createChainStakeService(chain) };
}
