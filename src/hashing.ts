// Hashing functions. Keep these in sync with the ones in circuits/src/main.nr.
import { poseidon1, poseidon2, poseidon3, poseidon4 } from "poseidon-lite";

export function hashSecret(secret: bigint): bigint {
  return poseidon1([secret]);
}

export function hashNullifier(nullifierSecret: bigint): bigint {
  return poseidon1([nullifierSecret]);
}

export function hashAllSecrets(
  nullifierSecret: bigint,
  secretHash: bigint,
  wakeTimestamp: bigint,
  donationAddress: bigint,
): bigint {
  return poseidon4([nullifierSecret, secretHash, wakeTimestamp, donationAddress]);
}

export function hashLeaf(token: bigint, amount: bigint, allSecretsHash: bigint): bigint {
  return poseidon3([token, amount, allSecretsHash]);
}

/** Hash for LeanIMT tree nodes. Same as PoseidonT3 in LeanIMT.sol. */
export function hashMerkleNode(leftNode: bigint, rightNode: bigint): bigint {
  return poseidon2([leftNode, rightNode]);
}
