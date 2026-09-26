import { toHex, type Address } from "viem";

import { hashAllSecrets, hashLeaf, hashNullifier, hashSecret } from "./hashing.js";

/** Everything the owner and the group know about a stake. Only the owner knows `secret`. */
export type Note = {
  token: bigint;
  amount: bigint;
  nullifierSecret: bigint;
  secretHash: bigint;
  wakeTimestamp: bigint;
  donationAddress: bigint;
};

/** A note plus the secret only the owner knows. The group uses `secret: 0n`. */
export type NoteWithSecret = { note: Note; secret: bigint };

/** The parts of a note that stay the same across wakes. */
export type StakeDetails = { token: bigint; amount: bigint; donationAddress: bigint };

/** Random value below the BN254 field modulus. Works in browsers and Node. */
export function randomFieldElement(): bigint {
  return BigInt(toHex(crypto.getRandomValues(new Uint8Array(31))));
}

export function addressToField(address: Address): bigint {
  return BigInt(address);
}

/** Creates a fresh note with new secrets. Use it for staking and for every wake. */
export function createNote(stakeDetails: StakeDetails, wakeTimestamp: bigint): NoteWithSecret {
  const secret = randomFieldElement();
  const note: Note = {
    ...stakeDetails,
    nullifierSecret: randomFieldElement(),
    secretHash: hashSecret(secret),
    wakeTimestamp,
  };
  return { note, secret };
}

/** The value passed to `stake()` as `_allSecretsHash`. */
export function noteAllSecretsHash(note: Note): bigint {
  return hashAllSecrets(note.nullifierSecret, note.secretHash, note.wakeTimestamp, note.donationAddress);
}

export function noteLeaf(note: Note): bigint {
  return hashLeaf(note.token, note.amount, noteAllSecretsHash(note));
}

export function noteNullifier(note: Note): bigint {
  return hashNullifier(note.nullifierSecret);
}
