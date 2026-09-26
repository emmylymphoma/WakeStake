/** Maximum Merkle tree depth the circuit supports. Must match MAX_DEPTH in circuits/common/src/lib.nr. */
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
  /** deploys registry proxies, e.g. the wakestake.eth registry and every group's registry */
  verifiableFactory: "0x9e726eb570beb6bceb495ab8cda7df517d4e841c",
  /** what those registry proxies point to */
  userRegistryImplementation: "0xa80338aaa8d23831cea25e858d1774534abb0263",
} as const;

/**
 * ENSv2 Enhanced Access Control roles, from RegistryRolesLib and EACBaseRolesLib in lib/contracts-v2.
 * Each role is a nybble, and its admin role (which can grant it) is the same bit shifted up by 128.
 */
export const ENS_ROLES = {
  REGISTRAR: 1n << 0n,
  RENEW: 1n << 16n,
  SET_SUBREGISTRY: 1n << 20n,
  SET_RESOLVER: 1n << 24n,
  /** can grant SET_RESOLVER on the name to others */
  SET_RESOLVER_ADMIN: (1n << 24n) << 128n,
  UNREGISTER: 1n << 12n,
  SET_PARENT: 1n << 8n,
  /** only ever an admin role: whoever holds it on a name can transfer that name */
  CAN_TRANSFER_ADMIN: (1n << 28n) << 128n,
  /** every role and every admin role */
  ALL: BigInt("0x" + "1".repeat(64)),
} as const;
