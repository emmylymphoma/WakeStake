/**
 * Core domain model. Nothing in here knows about React, wallets, chains or APIs,
 * so the mock services can be swapped for real ones without touching these types.
 */

/** Money is stored as integer cents (USD-pegged stablecoin in the real app). */
export type Cents = number;

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Profile {
  displayName: string;
  /** X/Twitter handle without the leading "@". */
  handle: string;
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
  /** Snoozes per alarm that cost nothing. The last free one comes with a warning. */
  freeSnoozes: number;
  /** If true, each extra paid snooze in the same alarm session doubles the penalty. */
  escalating: boolean;
}

export interface AlarmConfig {
  /** 24h "HH:MM". */
  time: string;
  days: Weekday[];
  label: string;
  snoozeMinutes: number;
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
}

export interface AppState {
  version: 1;
  onboarded: boolean;
  profile: Profile;
  wallet: Wallet | null;
  stake: StakeConfig;
  /** Stake still locked (what you can still lose). */
  balance: Cents;
  alarm: AlarmConfig;
  charity: Charity | null;
  /** Null until the bathroom QR is set up; then "I'm up" requires scanning it. */
  wakeCode: WakeCode | null;
  stats: Stats;
  /** Most recent first. */
  history: SnoozeEvent[];
  session: AlarmSession | null;
}
