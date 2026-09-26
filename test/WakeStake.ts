import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { CompiledCircuit } from "@noir-lang/noir_js";
import { network } from "hardhat";
import type { Address } from "viem";

import WakeStakeModule from "../ignition/modules/WakeStake.js";
import { createTimestampWindow, executeCircuit, generateProof } from "../src/circuit.js";
import { DAY, HOUR } from "../src/constants.js";
import { fetchMerkleTree } from "../src/merkleTree.js";
import {
  addressToField,
  createNote,
  noteAllSecretsHash,
  type NoteWithSecret,
  type StakeDetails,
} from "../src/note.js";

// Built by `nargo compile` (also run by `pnpm build:verifier`).
const compiledCircuit = JSON.parse(
  readFileSync(new URL("../circuits/target/wakestake.json", import.meta.url), "utf8"),
) as CompiledCircuit;

const STAKE_AMOUNT = 100n * 10n ** 18n;

describe("WakeStake", async function () {
  const { viem, ignition, networkHelpers } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [, owner, ownerRecipient, groupMember, charity] = await viem.getWalletClients();

  async function deployFixture() {
    const { wakeStake, verifier } = await ignition.deploy(WakeStakeModule);
    const token = await viem.deployContract("MockERC20", ["Mock", "MCK"]);
    await token.write.mint([owner.account.address, STAKE_AMOUNT]);
    await token.write.approve([wakeStake.address, STAKE_AMOUNT], { account: owner.account });
    return { wakeStake, verifier, token };
  }

  async function setup() {
    const { wakeStake, verifier, token } = await networkHelpers.loadFixture(deployFixture);
    const stakeDetails: StakeDetails = {
      token: addressToField(token.address),
      amount: STAKE_AMOUNT,
      donationAddress: addressToField(charity.account.address),
    };

    async function syncMerkleTree() {
      const merkleTree = await fetchMerkleTree(publicClient, wakeStake.address);
      assert.ok(
        await wakeStake.read.rootHistory([merkleTree.root]),
        "off-chain root unknown to the contract",
      );
      return merkleTree;
    }

    /** Timestamp window around the next block, which the caller then pins with setNextBlockTimestamp. */
    async function nextTimestampWindow() {
      const transactionTimestamp = BigInt(await networkHelpers.time.latest()) + 1n;
      return { transactionTimestamp, ...createTimestampWindow(transactionTimestamp) };
    }

    async function stake(secondsUntilWake: bigint) {
      const currentTimestamp = BigInt(await networkHelpers.time.latest());
      const stakedNote = createNote(stakeDetails, currentTimestamp + secondsUntilWake);
      await wakeStake.write.stake(
        [token.address, STAKE_AMOUNT, noteAllSecretsHash(stakedNote.note)],
        { account: owner.account },
      );
      return stakedNote;
    }

    /** Owner wakes up on time and re-stakes with a new wake time and fresh secrets. */
    async function wake(currentStake: NoteWithSecret, secondsUntilNewWake: bigint) {
      const { transactionTimestamp, pastTimestamp, futureTimestamp } = await nextTimestampWindow();
      const nextStake = createNote(stakeDetails, transactionTimestamp + secondsUntilNewWake);
      const { proof, newLeaf, root, nullifier } = await generateProof(compiledCircuit, {
        merkleTree: await syncMerkleTree(),
        ...currentStake,
        pastTimestamp,
        futureTimestamp,
        noteAfterWake: nextStake.note,
      });
      await networkHelpers.time.setNextBlockTimestamp(transactionTimestamp);
      await wakeStake.write.wake(
        [newLeaf, root, nullifier, pastTimestamp, futureTimestamp, proof],
        { account: owner.account },
      );
      return nextStake;
    }

    async function withdraw(
      currentStake: NoteWithSecret,
      recipient: Address,
      senderAccount = owner.account,
      // only for testing: send the transaction to a different recipient than the proof is for
      transactionRecipient: Address = recipient,
    ) {
      const { transactionTimestamp, pastTimestamp, futureTimestamp } = await nextTimestampWindow();
      const { proof, root, nullifier } = await generateProof(compiledCircuit, {
        merkleTree: await syncMerkleTree(),
        ...currentStake,
        pastTimestamp,
        futureTimestamp,
        withdrawal: {
          recipient: addressToField(recipient),
          token: stakeDetails.token,
          amount: STAKE_AMOUNT,
        },
      });
      await networkHelpers.time.setNextBlockTimestamp(transactionTimestamp);
      return wakeStake.write.withdraw(
        [
          transactionRecipient,
          token.address,
          STAKE_AMOUNT,
          root,
          nullifier,
          pastTimestamp,
          futureTimestamp,
          proof,
        ],
        { account: senderAccount },
      );
    }

    return {
      wakeStake,
      verifier,
      token,
      stakeDetails,
      syncMerkleTree,
      nextTimestampWindow,
      stake,
      wake,
      withdraw,
    };
  }

  it("stake, then withdraw on time", async function () {
    const { wakeStake, token, stake, withdraw } = await setup();

    const stakedNote = await stake(DAY);
    assert.equal(await token.read.balanceOf([wakeStake.address]), STAKE_AMOUNT);

    await networkHelpers.time.increase(8n * HOUR);
    await withdraw(stakedNote, ownerRecipient.account.address);

    assert.equal(await token.read.balanceOf([wakeStake.address]), 0n);
    assert.equal(await token.read.balanceOf([ownerRecipient.account.address]), STAKE_AMOUNT);
  });

  it("stake, wake a few times with different wake times, then withdraw", async function () {
    const { wakeStake, token, stake, wake, withdraw } = await setup();

    let currentStake = await stake(DAY);
    for (const [secondsAsleep, secondsUntilNewWake] of [
      [20n * HOUR, 2n * DAY],
      [30n * HOUR, 12n * HOUR],
      [11n * HOUR, 3n * DAY],
    ]) {
      await networkHelpers.time.increase(secondsAsleep); // still before the current wake time
      currentStake = await wake(currentStake, secondsUntilNewWake);
    }
    assert.equal(await token.read.balanceOf([wakeStake.address]), STAKE_AMOUNT);

    await networkHelpers.time.increase(2n * DAY);
    await withdraw(currentStake, ownerRecipient.account.address);

    assert.equal(await token.read.balanceOf([wakeStake.address]), 0n);
    assert.equal(await token.read.balanceOf([ownerRecipient.account.address]), STAKE_AMOUNT);
  });

  it("rejects withdrawing the same stake twice", async function () {
    const { stake, wake, withdraw } = await setup();

    let currentStake = await stake(DAY);
    currentStake = await wake(currentStake, DAY);
    await withdraw(currentStake, ownerRecipient.account.address);

    await viem.assertions.revertWith(
      withdraw(currentStake, ownerRecipient.account.address),
      "already withdrawn or woken up, nullifier provided was already spent",
    );
  });

  it("rejects a valid proof sent with a different recipient", async function () {
    const { verifier, stake, withdraw } = await setup();

    const stakedNote = await stake(DAY);
    const stolenRecipient = groupMember.account.address;

    // the generated verifier reverts on a bad proof instead of returning false
    await viem.assertions.revertWithCustomError(
      withdraw(stakedNote, ownerRecipient.account.address, groupMember.account, stolenRecipient),
      verifier,
      "SumcheckFailed",
    );
  });

  it("owner wakes up too late: cannot wake or withdraw to self, group member donates", async function () {
    const {
      wakeStake,
      token,
      stakeDetails,
      syncMerkleTree,
      nextTimestampWindow,
      stake,
      wake,
      withdraw,
    } = await setup();

    let currentStake = await stake(DAY);
    currentStake = await wake(currentStake, 2n * DAY);
    currentStake = await wake(currentStake, 12n * HOUR);

    // oversleep past the wake time
    await networkHelpers.time.increase(13n * HOUR);
    const { pastTimestamp, futureTimestamp } = await nextTimestampWindow();
    assert.ok(currentStake.note.wakeTimestamp < pastTimestamp);

    // owner can no longer wake
    const attemptedNextStake = createNote(stakeDetails, futureTimestamp + DAY);
    await assert.rejects(
      executeCircuit(compiledCircuit, {
        merkleTree: await syncMerkleTree(),
        ...currentStake,
        pastTimestamp,
        futureTimestamp,
        noteAfterWake: attemptedNextStake.note,
      }),
      /cannot wake\(\), only withdraw/,
    );

    // owner can no longer withdraw to themselves
    await assert.rejects(
      executeCircuit(compiledCircuit, {
        merkleTree: await syncMerkleTree(),
        ...currentStake,
        pastTimestamp,
        futureTimestamp,
        withdrawal: {
          recipient: addressToField(ownerRecipient.account.address),
          token: stakeDetails.token,
          amount: STAKE_AMOUNT,
        },
      }),
      /only withdraw to donation_address/,
    );

    // a group member knows every secret except `secret`, and sends the stake to the charity
    const groupMemberView: NoteWithSecret = { note: currentStake.note, secret: 0n };
    await withdraw(groupMemberView, charity.account.address, groupMember.account);

    assert.equal(await token.read.balanceOf([wakeStake.address]), 0n);
    assert.equal(await token.read.balanceOf([charity.account.address]), STAKE_AMOUNT);
  });
});
