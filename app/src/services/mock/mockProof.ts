import type { ProofService } from '../types';
import { delay, randomHex } from './util';

export function createMockProofService(latencyMs: number): ProofService {
  return {
    async issueReceipt({ tx, wallet, amount, charity, snoozeNumber, at }) {
      await delay(latencyMs);
      return {
        receiptId: `POS-${randomHex(3).toUpperCase()}-${String(snoozeNumber).padStart(4, '0')}`,
        txHash: tx.txHash,
        blockNumber: tx.blockNumber,
        network: tx.network,
        issuedAt: at,
        amount,
        charityId: charity.id,
        charityName: charity.name,
        walletAddress: wallet.address,
        snoozeNumber,
        proofHash: tx.proofHash ?? `0x${randomHex(32)}`,
        onChain: tx.onChain,
        explorerUrl: tx.explorerUrl,
      };
    },
  };
}
