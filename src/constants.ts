/** Maximum Merkle tree depth the circuit supports. Must match MAX_DEPTH in circuits/src/main.nr. */
export const MAX_TREE_DEPTH = 32;

/** Seconds between past_timestamp and future_timestamp in a proof. */
export const TIMESTAMP_WINDOW_SECONDS = 10n;

export const HOUR = 60n * 60n;
export const DAY = 24n * HOUR;
