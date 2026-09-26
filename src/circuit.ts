import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir, type CompiledCircuit, type InputMap } from "@noir-lang/noir_js";
import type { LeanIMT } from "@zk-kit/lean-imt";
import { toHex, type Hex } from "viem";

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

/** Converts the inputs into the format noir_js expects, named like `main` in circuits/src/main.nr. */
export function buildNoirInputMap(circuitInputs: CircuitInputs) {
  const { merkleTree, note } = circuitInputs;
  const merkleProof = merkleTree.generateProof(merkleTree.indexOf(noteLeaf(note)));
  const paddedSiblings = [
    ...merkleProof.siblings,
    ...Array<bigint>(MAX_TREE_DEPTH - merkleProof.siblings.length).fill(0n),
  ];
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

/** Generates an UltraHonk proof for the Solidity verifier. */
export async function generateProof(
  compiledCircuit: CompiledCircuit,
  circuitInputs: CircuitInputs,
): Promise<PublicValues & { proof: Hex }> {
  const { witness, publicValues } = await executeCircuit(compiledCircuit, circuitInputs);
  const barretenberg = await Barretenberg.new();
  try {
    const backend = new UltraHonkBackend(compiledCircuit.bytecode, barretenberg);
    const { proof } = await backend.generateProof(witness, { verifierTarget: "evm" });
    return { ...publicValues, proof: toHex(proof) };
  } finally {
    await barretenberg.destroy();
  }
}
