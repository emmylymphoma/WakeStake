/**
 * Service contracts. The UI only ever talks to these interfaces (via `useServices()`),
 * so each mock in ./mock can be replaced by a real implementation independently:
 *
 *   WalletService     → injected wallet / WalletConnect (viem)
 *   StakeService      → WakeStake escrow contract (deposit + slash to charity)
 *   ProofService      → on-chain receipt / Noir ZK "Proof of Snooze"
 *   CopywriterService → LLM that writes the public-shame post
 *   SocialService     → X/Twitter API
 *   CharityService    → curated charity registry
 *   WakeVerificationService → bathroom-QR check (later: server-signed / on-chain attestation)
 */
import type {
  Cents,
  Charity,
  ProofOfSnooze,
  ShamePost,
  Stats,
  TxResult,
  Wallet,
  WakeCode,
} from '../domain/types';
import type { WakeQrMatch } from '../domain/wakeCode';

export interface WalletService {
  connect(): Promise<Wallet>;
}

export interface StakeService {
  /** Lock `amount` into the stake escrow. */
  deposit(wallet: Wallet, amount: Cents): Promise<TxResult>;
  /** Move `amount` from the stake to the charity. */
  slash(input: { wallet: Wallet; amount: Cents; charity: Charity }): Promise<TxResult>;
}

export interface ProofService {
  issueReceipt(input: {
    tx: TxResult;
    wallet: Wallet;
    amount: Cents;
    charity: Charity;
    snoozeNumber: number;
    at: string;
  }): Promise<ProofOfSnooze>;
}

export interface ShameContext {
  displayName: string;
  handle: string;
  penalty: Cents;
  charityName: string;
  sessionSnoozeIndex: number;
  stats: Stats;
}

export interface CopywriterService {
  writeShamePost(ctx: ShameContext): Promise<string>;
}

export interface SocialService {
  publish(post: ShamePost): Promise<{ url: string }>;
}

export interface CharityService {
  list(): Promise<Charity[]>;
}

export type WakeVerification =
  | { ok: true; verifiedAt: string }
  | { ok: false; reason: Exclude<WakeQrMatch, 'ok'> };

export interface WakeVerificationService {
  /** Create a new code to print (replaces any previous one). */
  enroll(): Promise<WakeCode>;
  /** Check scanned QR text against the user's code. */
  verify(code: WakeCode, scanned: string): Promise<WakeVerification>;
}

export interface Services {
  wallet: WalletService;
  stake: StakeService;
  proof: ProofService;
  copywriter: CopywriterService;
  social: SocialService;
  charities: CharityService;
  wakeVerification: WakeVerificationService;
}
