import { createMockCharityService } from './mock/mockCharities';
import { createMockCopywriterService } from './mock/mockCopywriter';
import { createMockProofService } from './mock/mockProof';
import { createMockSocialService } from './mock/mockSocial';
import { createMockStakeService } from './mock/mockStake';
import { createMockWakeVerificationService } from './mock/mockWakeVerification';
import { createMockWalletService } from './mock/mockWallet';
import type { Services } from './types';

/**
 * Composition root for services. To go live, replace individual entries with real
 * implementations (e.g. `stake: createContractStakeService(publicClient, walletClient)`)
 * — no screen needs to change.
 */
export function createMockServices({ latencyMs = 600 }: { latencyMs?: number } = {}): Services {
  return {
    wallet: createMockWalletService(latencyMs),
    stake: createMockStakeService(latencyMs),
    proof: createMockProofService(latencyMs),
    copywriter: createMockCopywriterService(latencyMs),
    social: createMockSocialService(latencyMs),
    charities: createMockCharityService(latencyMs / 2),
    wakeVerification: createMockWakeVerificationService(latencyMs / 2),
  };
}
