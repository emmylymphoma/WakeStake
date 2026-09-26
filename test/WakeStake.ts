import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { Noir, type CompiledCircuit } from "@noir-lang/noir_js";
import { network } from "hardhat";
import { zeroAddress, type Address } from "viem";

import WakeStakeModule from "../ignition/modules/WakeStake.js";
import {
  buildNoirInputMap,
  createTimestampWindow,
  executeCircuit,
  generateProof,
} from "../src/circuit.js";
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
const FEE_PERCENTAGE = 5n;
const LOSE_FEE = (STAKE_AMOUNT * FEE_PERCENTAGE) / 100n;

describe("WakeStake", async function () {
  const { viem, ignition, networkHelpers } = await network.create();
  const publicClient = await viem.getPublicClient();
  // `owner` is the staker who has to wake up, `contractOwner` is the Ownable admin
  const [contractOwner, owner, ownerRecipient, groupMember, charity, feeCollector, newFeeCollector] =
    await viem.getWalletClients();

  async function deployFixture() {
    const { wakeStake, verifier, donationGroupFactory } = await ignition.deploy(WakeStakeModule, {
      parameters: {
        WakeStakeModule: {
          feePayoutAddress: feeCollector.account.address,
          feePercentage: FEE_PERCENTAGE,
        },
      },
    });
    const token = await viem.deployContract("MockERC20", ["Mock", "MCK"]);
    await token.write.mint([owner.account.address, STAKE_AMOUNT]);
    await token.write.approve([wakeStake.address, STAKE_AMOUNT], { account: owner.account });
    // groups are created here, since loadFixture reverts anything deployed before it
    const { result: donationGroupAddress } = await donationGroupFactory.simulate.createDonationGroup([
      charity.account.address,
    ]);
    await donationGroupFactory.write.createDonationGroup([charity.account.address]);
    const donationGroup = await viem.getContractAt("DonationGroup", donationGroupAddress);
    // a group that can return 0 from donationAddress(), which a real DonationGroup can't
    const mockGroup = await viem.deployContract("MockDonationAddressProvider", [charity.account.address]);
    return { wakeStake, verifier, token, donationGroup, mockGroup };
  }

  /** @param donateTo what the stake is committed to: the charity wallet, a factory-made DonationGroup, or the mock group */
  async function setup({ donateTo = "charity" }: { donateTo?: "charity" | "donationGroup" | "mockGroup" } = {}) {
    const { wakeStake, verifier, token, donationGroup, mockGroup } = await networkHelpers.loadFixture(deployFixture);
    const donationAddress = { charity: charity.account.address, donationGroup: donationGroup.address, mockGroup: mockGroup.address }[donateTo];
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
      const { proof, root, nullifier, lose } = await generateProof(compiledCircuit, {
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

  it("stake, then withdraw on time", async function () {
    const { wakeStake, token, stake, withdraw } = await setup();

    const stakedNote = await stake(DAY);
    assert.equal(await token.read.balanceOf([wakeStake.address]), STAKE_AMOUNT);

    await networkHelpers.time.increase(8n * HOUR);
    await withdraw(stakedNote, ownerRecipient.account.address);

    assert.equal(await token.read.balanceOf([wakeStake.address]), 0n);
    assert.equal(await token.read.balanceOf([ownerRecipient.account.address]), STAKE_AMOUNT);
    assert.equal(await token.read.balanceOf([feeCollector.account.address]), 0n, "no fee when on time");
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

    // a group member knows every secret except `secret`
    const groupMemberView: NoteWithSecret = { note: currentStake.note, secret: 0n };

    // they can't skip the fee by claiming the owner didn't lose
    const { noirInputMap } = buildNoirInputMap({
      merkleTree: await syncMerkleTree(),
      ...groupMemberView,
      pastTimestamp,
      futureTimestamp,
      withdrawal: {
        recipient: stakeDetails.donationAddress,
        token: stakeDetails.token,
        amount: STAKE_AMOUNT,
      },
    });
    assert.equal(noirInputMap.lose, true);
    await assert.rejects(
      new Noir(compiledCircuit).execute({ ...noirInputMap, lose: false }),
      /lose must be true exactly when the owner woke up too late/,
    );

    // so they send the stake to the charity, and the fee goes to the fee payout address
    await viem.assertions.emitWithArgs(
      withdraw(groupMemberView, charity.account.address, groupMember.account),
      wakeStake,
      "YouLose",
      [charity.account.address, charity.account.address, token.address, STAKE_AMOUNT - LOSE_FEE],
    );

    assert.equal(await token.read.balanceOf([wakeStake.address]), 0n);
    assert.equal(await token.read.balanceOf([charity.account.address]), STAKE_AMOUNT - LOSE_FEE);
    assert.equal(await token.read.balanceOf([feeCollector.account.address]), LOSE_FEE);
  });

  describe("lost stake committed to a group contract", function () {
    type Setup = Awaited<ReturnType<typeof setup>>;

    /**
     * Stakes with `donateTo` as the donation address, lets `configureMockGroup` change what the mock's
     * donationAddress() returns, oversleeps, and a group member withdraws.
     */
    async function loseStakeToGroup(
      donateTo: "donationGroup" | "mockGroup",
      expectedDonationAddress: "charity" | "group",
      configureMockGroup: (mockGroup: Setup["mockGroup"]) => Promise<unknown> = async () => {},
    ) {
      const setupResult = await setup({ donateTo });
      const { wakeStake, token, mockGroup, stake, withdraw } = setupResult;
      const group = setupResult[donateTo];
      await configureMockGroup(mockGroup);
      const stakedNote = await stake(DAY);
      await networkHelpers.time.increase(DAY + HOUR);
      await viem.assertions.emitWithArgs(
        withdraw({ note: stakedNote.note, secret: 0n }, group.address, groupMember.account),
        wakeStake,
        "YouLose",
        [
          expectedDonationAddress === "charity" ? charity.account.address : group.address,
          group.address,
          token.address,
          STAKE_AMOUNT - LOSE_FEE,
        ],
      );
      assert.equal(await token.read.balanceOf([wakeStake.address]), 0n);
      assert.equal(await token.read.balanceOf([feeCollector.account.address]), LOSE_FEE);
      return { wakeStake, token, group };
    }

    it("pays a factory-made DonationGroup's donationAddress directly", async function () {
      const { wakeStake, token, group } = await loseStakeToGroup("donationGroup", "charity");

      assert.equal(await token.read.balanceOf([charity.account.address]), STAKE_AMOUNT - LOSE_FEE);
      assert.equal(await token.read.balanceOf([group.address]), 0n);
      assert.equal(
        (await wakeStake.read.getLoserDonationAddress([group.address])).toLowerCase(),
        charity.account.address.toLowerCase(),
      );
    });

    it("pays the group itself when donationAddress() returns zero", async function () {
      const { token, group } = await loseStakeToGroup("mockGroup", "group", (mockGroup) =>
        mockGroup.write.setDonationAddress([zeroAddress]),
      );

      assert.equal(await token.read.balanceOf([group.address]), STAKE_AMOUNT - LOSE_FEE);
      assert.equal(await token.read.balanceOf([charity.account.address]), 0n);
    });
  });

  it("only the contract owner can change the fee payout address", async function () {
    const { wakeStake } = await setup();

    assert.equal(
      (await wakeStake.read.owner()).toLowerCase(),
      contractOwner.account.address.toLowerCase(),
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      wakeStake.write.setFeePayoutAddress([newFeeCollector.account.address], {
        account: owner.account,
      }),
      wakeStake,
      "OwnableUnauthorizedAccount",
      [owner.account.address],
    );

    await viem.assertions.emitWithArgs(
      wakeStake.write.setFeePayoutAddress([newFeeCollector.account.address], {
        account: contractOwner.account,
      }),
      wakeStake,
      "FeePayoutAddressChanged",
      [newFeeCollector.account.address],
    );
    assert.equal(
      (await wakeStake.read.feePayoutAddress()).toLowerCase(),
      newFeeCollector.account.address.toLowerCase(),
    );
  });
});
