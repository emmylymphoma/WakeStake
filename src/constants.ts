/** Maximum Merkle tree depth the circuit supports. Must match MAX_DEPTH in circuits/src/main.nr. */
export const MAX_TREE_DEPTH = 32;

export const MINUTE = 60n;
export const HOUR = 60n * MINUTE;

/** Seconds between past_timestamp and future_timestamp in a proof. */
export const TIMESTAMP_WINDOW_SECONDS = 10n * MINUTE;

export const DAY = 24n * HOUR;
export const YEAR = 365n * DAY;

/** Root ENS name for WakeStake (`<label>.eth`) and how long `pnpm ens:register` registers it for. */
export const ENS_ROOT_LABEL = "wakestake";
export const ENS_ROOT_REGISTRATION_YEARS = 1n;

/**
 * ENSv2 beta on Sepolia, deployed 2026-09-15. ENS may reset the beta and redeploy,
 * so recheck these against https://docs.ens.domains/learn/deployments when things revert.
 */
export const ENS_SEPOLIA = {
  ethRegistrar: "0xabe76f6c8dfced81aa5a2bb8034202a7136b94ca",
  ethRegistry: "0x657ea849311d3d5823348dded7c2aaafb3ede09e",
  /** 6 decimals, free public mint, accepted by the registrar's price oracle. */
  mockUsdc: "0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e",
} as const;
