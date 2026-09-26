/**
 * Service contracts. The UI only ever talks to these interfaces (via `useServices()`),
 * so each mock in ./mock can be replaced by a real implementation independently:
 *
 *   WalletService     → injected wallet (viem), see ./chain
 *   StakeService      → WakeStake contract: stake, ZK-proven wake, slash to charity, see ./chain
 *   ProofService      → receipt for a slash (carries the ZK proof hash in chain mode)
 *   CopywriterService → LLM that writes the public-shame post
 *   SocialService     → X/Twitter API
 *   XAccountService   → X OAuth 2.0 (PKCE) login, tokens kept server-side
 *   CharityOracleService → reads your X (or questionnaire) at snooze time, LLM picks the
 *                       registered charity you'd hate funding most
 *   WakeVerificationService → bathroom-QR check (later: server-signed / on-chain attestation)
 */
import type {
  BeneficiarySource,
  Cents,
  Charity,
  CharityPick,
  ProofOfSnooze,
  ShamePost,
  Stats,
  TxResult,
  Wallet,
  WakeCode,
  XAccount,
} from '../domain/types';
import type { WakeQrMatch } from '../domain/wakeCode';

export interface WalletService {
  connect(): Promise<Wallet>;
}

/**
 * per-snooze: each late snooze costs part of the stake (mock).
 * all-or-nothing: the WakeStake contract, where the first late snooze sends the whole stake to charity.
 */
export type PenaltyModel = 'per-snooze' | 'all-or-nothing';

export interface StakeService {
  readonly penaltyModel: PenaltyModel;
  /** Lock `amount` until `deadline`. `wakeCode` is what proves you got up on time. */
  deposit(input: { wallet: Wallet; amount: Cents; deadline: Date; wakeCode: WakeCode }): Promise<TxResult>;
  /**
   * The user is verified up. On-chain: prove it before the deadline and roll the stake over to
   * `nextDeadline(currentDeadline)`. Null when nothing needed to be sent.
   */
  wake(input: {
    wallet: Wallet;
    wakeCode: WakeCode;
    nextDeadline: (after: Date) => Date | null;
  }): Promise<TxResult | null>;
  /** Move `amount` from the stake to the charity. */
  slash(input: { wallet: Wallet; amount: Cents; charity: Charity }): Promise<TxResult>;
  /**
   * Cash the whole stake back out to the wallet. On-chain this is the same proof as a wake, so it
   * only works before the deadline: after it, the stake belongs to the charity. Null when nothing
   * is locked on-chain.
   */
  withdraw(input: { wallet: Wallet }): Promise<TxResult | null>;
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
  /** The amount in the staked token ("50 wUSD"); used instead of dollars when set. */
  amountLabel?: string;
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

export interface XAccountService {
  /** Real: OAuth redirect. The mock takes the handle from a fake consent sheet. */
  connect(opts?: { handleHint?: string }): Promise<XAccount>;
}

export type OracleStep = 'fetching' | 'analyzing' | 'matching';

export interface CharityOracleService {
  /**
   * Analyse the user *now* (fresh X read, or their questionnaire) and pick the charity
   * they'd hate funding most. Called right before the first illegal snooze of a morning.
   */
  pickCharity(source: BeneficiarySource, onProgress?: (step: OracleStep) => void): Promise<CharityPick>;
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
  xAccount: XAccountService;
  charityOracle: CharityOracleService;
  wakeVerification: WakeVerificationService;
}
