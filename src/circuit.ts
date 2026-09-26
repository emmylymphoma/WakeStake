import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir, type CompiledCircuit, type InputMap } from "@noir-lang/noir_js";
import type { LeanIMT } from "@zk-kit/lean-imt";
import { toHex, type Address, type Hex } from "viem";

import { MAX_TREE_DEPTH, TIMESTAMP_WINDOW_SECONDS } from "./constants.js";
import { noteLeaf, noteNullifier, type Note } from "./note.js";

export type WithdrawalDetails = { recipient: bigint; token: bigint; amount: bigint };

export type CircuitInputs = {
  merkleTree: LeanIMT<bigint>;
  note: Note;
  secret: bigint; // 0n when the prover doesn't know it
  pastTimestamp: bigint;
  futureTimestamp: bigint;
} & ({ noteAfterWake: Note } | { withdrawal: WithdrawalDetails });

/** The values the contract call needs, besides the proof. */
export type PublicValues = { root: bigint; nullifier: bigint; newLeaf: bigint; lose: boolean };

/** Past and future timestamps around `currentTimestamp`, for the circuit and the contract call. */
export function createTimestampWindow(currentTimestamp: bigint) {
  return {
    pastTimestamp: currentTimestamp - TIMESTAMP_WINDOW_SECONDS / 2n,
    futureTimestamp: currentTimestamp + TIMESTAMP_WINDOW_SECONDS / 2n,
  };
}

/** Merkle proof for `note`'s leaf, padded to the circuits' MAX_DEPTH. */
function merkleProofFor(merkleTree: LeanIMT<bigint>, note: Note) {
  const merkleProof = merkleTree.generateProof(merkleTree.indexOf(noteLeaf(note)));
  const paddedSiblings = [
    ...merkleProof.siblings,
    ...Array<bigint>(MAX_TREE_DEPTH - merkleProof.siblings.length).fill(0n),
  ];
  return { merkleProof, paddedSiblings };
}

/** Converts the inputs into the format noir_js expects, named like `main` in circuits/wakestake/src/main.nr. */
export function buildNoirInputMap(circuitInputs: CircuitInputs) {
  const { merkleTree, note } = circuitInputs;
  const { merkleProof, paddedSiblings } = merkleProofFor(merkleTree, note);
  const noteAfterWake = "noteAfterWake" in circuitInputs ? circuitInputs.noteAfterWake : undefined;
  const withdrawal = "withdrawal" in circuitInputs ? circuitInputs.withdrawal : undefined;

  const publicValues: PublicValues = {
    root: merkleProof.root,
    nullifier: noteNullifier(note),
    newLeaf: noteAfterWake ? noteLeaf(noteAfterWake) : 0n,
    // woke up too late, same check as `wake_is_in_past` in the circuit
    lose: note.wakeTimestamp < circuitInputs.pastTimestamp,
  };
  const noirInputMap: InputMap = {
    root: toHex(publicValues.root),
    nullifier: toHex(publicValues.nullifier),
    new_leaf: toHex(publicValues.newLeaf),
    withdraw_amount: toHex(withdrawal?.amount ?? 0n),
    withdraw_recipient: toHex(withdrawal?.recipient ?? 0n),
    withdraw_token: toHex(withdrawal?.token ?? 0n),
    future_timestamp: toHex(circuitInputs.futureTimestamp),
    past_timestamp: toHex(circuitInputs.pastTimestamp),
    lose: publicValues.lose,
    nullifier_secret: toHex(note.nullifierSecret),
    secret_hash: toHex(note.secretHash),
    wake_timestamp: toHex(note.wakeTimestamp),
    donation_address: toHex(note.donationAddress),
    secret: toHex(circuitInputs.secret),
    secret_amount: toHex(note.amount),
    secret_token: toHex(note.token),
    new_nullifier_secret: toHex(noteAfterWake?.nullifierSecret ?? 0n),
    new_secret_hash: toHex(noteAfterWake?.secretHash ?? 0n),
    new_wake_timestamp: toHex(noteAfterWake?.wakeTimestamp ?? 0n),
    index: toHex(merkleProof.index),
    depth: merkleProof.siblings.length,
    siblings: paddedSiblings.map((sibling) => toHex(sibling)),
  };
  return { noirInputMap, publicValues };
}

/** Runs the circuit without proving. Fast, and throws with the assert message if a constraint fails. */
export async function executeCircuit(compiledCircuit: CompiledCircuit, circuitInputs: CircuitInputs) {
  const { noirInputMap, publicValues } = buildNoirInputMap(circuitInputs);
  const { witness } = await new Noir(compiledCircuit).execute(noirInputMap);
  return { witness, publicValues };
}

/** Proves an executed witness as an UltraHonk proof for the generated Solidity verifier. */
async function proveWitness(compiledCircuit: CompiledCircuit, witness: Uint8Array): Promise<Hex> {
  const barretenberg = await Barretenberg.new();
  try {
    const backend = new UltraHonkBackend(compiledCircuit.bytecode, barretenberg);
    const { proof } = await backend.generateProof(witness, { verifierTarget: "evm" });
    return toHex(proof);
  } finally {
    await barretenberg.destroy();
  }
}

/** Generates a wakestake circuit proof for WakeStake's wake() and withdraw(). */
export async function generateProof(
  compiledCircuit: CompiledCircuit,
  circuitInputs: CircuitInputs,
): Promise<PublicValues & { proof: Hex }> {
  const { witness, publicValues } = await executeCircuit(compiledCircuit, circuitInputs);
  return { ...publicValues, proof: await proveWitness(compiledCircuit, witness) };
}

// stake_ownership circuit: "I own an unspent stake of at least minAmount that donates to donationAddress"

export type StakeOwnershipInputs = {
  merkleTree: LeanIMT<bigint>;
  note: Note;
  secret: bigint; // only the owner knows it, so the group can't prove ownership
  minAmount: bigint;
  claimer: Address; // the proof only works for this address
};

export type StakeOwnershipPublicValues = {
  root: bigint;
  nullifier: bigint;
  token: bigint;
  minAmount: bigint;
  donationAddress: bigint;
  claimer: bigint;
};

/** Converts the inputs into the format noir_js expects, named like `main` in circuits/stake_ownership/src/main.nr. */
export function buildStakeOwnershipInputMap(inputs: StakeOwnershipInputs) {
  const { merkleTree, note } = inputs;
  const { merkleProof, paddedSiblings } = merkleProofFor(merkleTree, note);
  const publicValues: StakeOwnershipPublicValues = {
    root: merkleProof.root,
    nullifier: noteNullifier(note),
    token: note.token,
    minAmount: inputs.minAmount,
    donationAddress: note.donationAddress,
    claimer: BigInt(inputs.claimer),
  };
  const noirInputMap: InputMap = {
    root: toHex(publicValues.root),
    nullifier: toHex(publicValues.nullifier),
    token: toHex(publicValues.token),
    min_amount: toHex(publicValues.minAmount),
    donation_address: toHex(publicValues.donationAddress),
    claimer: toHex(publicValues.claimer),
    nullifier_secret: toHex(note.nullifierSecret),
    secret_hash: toHex(note.secretHash),
    wake_timestamp: toHex(note.wakeTimestamp),
    amount: toHex(note.amount),
    secret: toHex(inputs.secret),
    index: toHex(merkleProof.index),
    depth: merkleProof.siblings.length,
    siblings: paddedSiblings.map((sibling) => toHex(sibling)),
  };
  return { noirInputMap, publicValues };
}

/** The verifier's `_publicInputs`, in the order of the `pub` parameters of the stake_ownership circuit. */
export function stakeOwnershipPublicInputs(publicValues: StakeOwnershipPublicValues): Hex[] {
  const { root, nullifier, token, minAmount, donationAddress, claimer } = publicValues;
  return [root, nullifier, token, minAmount, donationAddress, claimer].map((value) => toHex(value, { size: 32 }));
}

/** Runs the stake_ownership circuit without proving. Throws with the assert message if a constraint fails. */
export async function executeStakeOwnershipCircuit(compiledCircuit: CompiledCircuit, inputs: StakeOwnershipInputs) {
  const { noirInputMap, publicValues } = buildStakeOwnershipInputMap(inputs);
  const { witness } = await new Noir(compiledCircuit).execute(noirInputMap);
  return { witness, publicValues };
}

/** Generates a stake_ownership proof for StakeOwnershipVerifier. */
export async function generateStakeOwnershipProof(
  compiledCircuit: CompiledCircuit,
  inputs: StakeOwnershipInputs,
): Promise<{ publicValues: StakeOwnershipPublicValues; publicInputs: Hex[]; proof: Hex }> {
  const { witness, publicValues } = await executeStakeOwnershipCircuit(compiledCircuit, inputs);
  const proof = await proveWitness(compiledCircuit, witness);
  return { publicValues, publicInputs: stakeOwnershipPublicInputs(publicValues), proof };
}
