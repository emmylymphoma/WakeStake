/**
 * Core domain model. Nothing in here knows about React, wallets, chains or APIs,
 * so the mock services can be swapped for real ones without touching these types.
 */

/** Money is stored as integer cents (USD-pegged stablecoin in the real app). */
export type Cents = number;

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Profile {
  displayName: string;
  /** X/Twitter handle without the leading "@". Empty when no X account is linked. */
  handle: string;
}

export interface XAccount {
  handle: string;
  connectedAt: string;
}

/** Side A, side B, or "don't care" on one questionnaire topic. */
export type Stance = 'a' | 'b' | 'meh';

/** questionId → the side you took. */
export type QuestionnaireAnswers = Record<string, Stance>;

/**
 * What WakeStake uses to pick a charity you'd hate. The user never picks the charity;
 * they only choose how we get to know them.
 */
export type BeneficiarySource =
  | { kind: 'x'; account: XAccount }
  | { kind: 'questionnaire'; answers: QuestionnaireAnswers; completedAt: string };

/** The charity picked for one morning, plus why. Revealed once, right before the first illegal snooze. */
export interface CharityPick {
  charity: Charity;
  basis: BeneficiarySource['kind'];
  reasons: string[];
  analyzedAt: string;
}

export interface Wallet {
  address: string;
  network: string;
}

export interface Charity {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  category: string;
}

export interface StakeConfig {
  /** Total amount locked up. */
  amount: Cents;
  /** Base penalty for a single snooze. */
  penaltyPerSnooze: Cents;
  /** If true, each extra paid snooze in the same alarm session doubles the penalty. */
  escalating: boolean;
  /** The on-chain contract can't do partial slashes: the first paid snooze costs the whole stake. */
  allOrNothing: boolean;
}

export interface AlarmConfig {
  /** 24h "HH:MM" — when you actually have to be up. Snoozing from here on costs money. */
  wakeBy: string;
  /**
   * Free 5-minute snoozes. The alarm first rings this many snoozes *before* `wakeBy`,
   * so the last legal snooze ends exactly at `wakeBy`.
   */
  legalSnoozes: number;
  days: Weekday[];
  label: string;
}

export interface Stats {
  /** Every snooze, free or paid. */
  snoozeCount: number;
  totalLost: Cents;
  /** Consecutive alarms dismissed without paying a penalty (free snoozes are allowed). */
  streak: number;
  bestStreak: number;
  wakeCount: number;
}

/** Result of a stake transfer (deposit or slash). */
export interface TxResult {
  txHash: string;
  blockNumber: number;
  network: string;
  /** A real transaction (chain mode), not a mock. */
  onChain?: boolean;
  /** Block explorer link, if the chain has one. */
  explorerUrl?: string;
  /** Hash of the ZK proof sent with the transaction, if any. */
  proofHash?: string;
  /** The amount in the staked token, e.g. "50 wUSD". Real stakes aren't in dollars. */
  amountLabel?: string;
  /** What the charity actually received after the Uniswap swap, e.g. "44.8 cUSD". */
  donatedAs?: string;
}

/** Verifiable receipt that a snooze happened and was paid for. */
export interface ProofOfSnooze {
  receiptId: string;
  txHash: string;
  blockNumber: number;
  network: string;
  issuedAt: string;
  amount: Cents;
  charityId: string;
  charityName: string;
  walletAddress: string;
  snoozeNumber: number;
  proofHash: string;
  onChain?: boolean;
  explorerUrl?: string;
  amountLabel?: string;
  donatedAs?: string;
}

export interface ShamePost {
  author: Profile;
  text: string;
  createdAt: string;
  /** Set once the post has been published. */
  url?: string;
}

export interface SnoozeEvent {
  id: string;
  at: string;
  penalty: Cents;
  balanceAfter: Cents;
  /** 0-based index of this snooze inside its alarm session (free snoozes included). */
  sessionSnoozeIndex: number;
  receipt: ProofOfSnooze;
  post: ShamePost;
}

/**
 * The code printed as a QR and stuck in the user's bathroom. Scanning it is the only
 * way to dismiss the alarm, so you have to physically get out of bed.
 */
export interface WakeCode {
  id: string;
  createdAt: string;
}

/** One ringing of the alarm, from first ring until the user gets up. */
export interface AlarmSession {
  startedAt: string;
  /** All snoozes this session, free and paid. */
  snoozes: number;
  lost: Cents;
  /** Set while snoozed: when the alarm rings again. Null while ringing. */
  snoozedUntil: string | null;
  /** This morning's charity, picked at the first illegal snooze. Null until then. */
  pick: CharityPick | null;
}

export interface AppState {
  version: 2;
  onboarded: boolean;
  profile: Profile;
  wallet: Wallet | null;
  stake: StakeConfig;
  /** Stake still locked (what you can still lose). */
  balance: Cents;
  alarm: AlarmConfig;
  beneficiary: BeneficiarySource | null;
  /** Null until the bathroom QR is set up; then "I'm up" requires scanning it. */
  wakeCode: WakeCode | null;
  stats: Stats;
  /** Most recent first. */
  history: SnoozeEvent[];
  session: AlarmSession | null;
  /** Shows the "ring now" / "simulate" buttons. A web page can't ring by itself, so on by default. */
  demoControls: boolean;
}
