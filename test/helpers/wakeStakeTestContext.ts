// Shared setup for the TypeScript tests: deploys WakeStake with Ignition and wraps stake / wake / withdraw.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { CompiledCircuit } from "@noir-lang/noir_js";
import { network } from "hardhat";
import type { Address } from "viem";

import WakeStakeModule from "../../ignition/modules/WakeStake.js";
import { createTimestampWindow, generateProof } from "../../src/circuit.js";
import { fetchMerkleTree } from "../../src/merkleTree.js";
import {
  addressToField,
  createNote,
  noteAllSecretsHash,
  type NoteWithSecret,
  type StakeDetails,
} from "../../src/note.js";

// Built by `nargo compile --workspace` (also run by `pnpm build:verifier`).
const loadCircuit = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../../circuits/target/${name}.json`, import.meta.url), "utf8"),
  ) as CompiledCircuit;
export const wakeStakeCircuit = loadCircuit("wakestake");
export const stakeOwnershipCircuit = loadCircuit("stake_ownership");

export const STAKE_AMOUNT = 100n * 10n ** 18n;
export const FEE_PERCENTAGE = 5n;
export const LOSE_FEE = (STAKE_AMOUNT * FEE_PERCENTAGE) / 100n;

/** Creates an isolated chain. Call it once per test file. */
export async function createWakeStakeTestContext() {
  const { viem, ignition, networkHelpers } = await network.create();
  const publicClient = await viem.getPublicClient();
  // `owner` is the staker who has to wake up, `contractOwner` is WakeStake's Ownable admin,
  // `groupAdmin` created the DonationGroup
  const allWallets = await viem.getWalletClients();
  const [contractOwner, owner, ownerRecipient, groupMember, charity, feeCollector, newFeeCollector, groupAdmin] =
    allWallets;
  // more stakers with their own funds, for votes that need several members
  const extraStakers = allWallets.slice(8, 12);

  async function deployFixture() {
    const { wakeStake, verifier, stakeOwnershipVerifier, donationGroupFactory } = await ignition.deploy(
      WakeStakeModule,
      {
        parameters: {
          WakeStakeModule: {
            feePayoutAddress: feeCollector.account.address,
            feePercentage: FEE_PERCENTAGE,
          },
        },
      },
    );
    const token = await viem.deployContract("MockERC20", ["Mock", "MCK"]);
    for (const staker of [owner, ...extraStakers]) {
      await token.write.mint([staker.account.address, STAKE_AMOUNT]);
      await token.write.approve([wakeStake.address, STAKE_AMOUNT], { account: staker.account });
    }
    // groups are created here, since loadFixture reverts anything deployed before it
    const createArgs = [charity.account.address, token.address, STAKE_AMOUNT] as const;
    const { result: donationGroupAddress } = await donationGroupFactory.simulate.createDonationGroup(createArgs, {
      account: groupAdmin.account.address,
    });
    await donationGroupFactory.write.createDonationGroup(createArgs, { account: groupAdmin.account });
    const donationGroup = await viem.getContractAt("DonationGroup", donationGroupAddress);
    // a group that can return 0 from donationAddress(), which a real DonationGroup can't
    const mockGroup = await viem.deployContract("MockDonationAddressProvider", [charity.account.address]);
    return { wakeStake, verifier, stakeOwnershipVerifier, donationGroupFactory, token, donationGroup, mockGroup };
  }

  /** @param donateTo what the stake is committed to: the charity wallet, a factory-made DonationGroup, or the mock group */
  async function setup({ donateTo = "charity" }: { donateTo?: "charity" | "donationGroup" | "mockGroup" } = {}) {
    const { wakeStake, verifier, stakeOwnershipVerifier, donationGroupFactory, token, donationGroup, mockGroup } =
      await networkHelpers.loadFixture(deployFixture);
    const donationAddress = {
      charity: charity.account.address,
      donationGroup: donationGroup.address,
      mockGroup: mockGroup.address,
    }[donateTo];
    const stakeDetails: StakeDetails = {
      token: addressToField(token.address),
      amount: STAKE_AMOUNT,
      donationAddress: addressToField(donationAddress),
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

    async function stake(secondsUntilWake: bigint, staker = owner) {
      const currentTimestamp = BigInt(await networkHelpers.time.latest());
      const stakedNote = createNote(stakeDetails, currentTimestamp + secondsUntilWake);
      await wakeStake.write.stake(
        [token.address, STAKE_AMOUNT, noteAllSecretsHash(stakedNote.note)],
        { account: staker.account },
      );
      return stakedNote;
    }

    /** Owner wakes up on time and re-stakes with a new wake time and fresh secrets. */
    async function wake(currentStake: NoteWithSecret, secondsUntilNewWake: bigint) {
      const { transactionTimestamp, pastTimestamp, futureTimestamp } = await nextTimestampWindow();
      const nextStake = createNote(stakeDetails, transactionTimestamp + secondsUntilNewWake);
      const { proof, newLeaf, root, nullifier } = await generateProof(wakeStakeCircuit, {
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
      const { proof, root, nullifier, lose } = await generateProof(wakeStakeCircuit, {
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
          lose,
          proof,
        ],
        { account: senderAccount },
      );
    }

    return {
      wakeStake,
      verifier,
      stakeOwnershipVerifier,
      donationGroupFactory,
      token,
      donationGroup,
      mockGroup,
      stakeDetails,
      syncMerkleTree,
      nextTimestampWindow,
      stake,
      wake,
      withdraw,
    };
  }

  return {
    viem,
    networkHelpers,
    setup,
    wallets: { contractOwner, owner, ownerRecipient, groupMember, charity, feeCollector, newFeeCollector, groupAdmin, extraStakers },
  };
}
