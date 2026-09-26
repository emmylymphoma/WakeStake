import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Noir } from "@noir-lang/noir_js";
import { zeroAddress, type Address } from "viem";

import { buildNoirInputMap, executeCircuit } from "../src/circuit.js";
import { DAY, HOUR } from "../src/constants.js";
import { addressToField, createNote, type NoteWithSecret } from "../src/note.js";
import {
  createWakeStakeTestContext,
  LOSE_FEE,
  STAKE_AMOUNT,
  wakeStakeCircuit,
} from "./helpers/wakeStakeTestContext.js";

describe("WakeStake", async function () {
  const {
    viem,
    networkHelpers,
    setup,
    wallets: { contractOwner, owner, ownerRecipient, groupMember, charity, feeCollector, newFeeCollector },
  } = await createWakeStakeTestContext();

  const sameAddress = (actual: Address, expected: Address) => assert.equal(actual.toLowerCase(), expected.toLowerCase());

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
      executeCircuit(wakeStakeCircuit, {
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
      executeCircuit(wakeStakeCircuit, {
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
      new Noir(wakeStakeCircuit).execute({ ...noirInputMap, lose: false }),
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

  it("only the admin can change the fee payout address", async function () {
    const { wakeStake, wakeStakeRegistry } = await setup();

    // the deployer registered admin.wakestake.eth to itself
    sameAddress(await wakeStakeRegistry.read.findOwner(["admin"]), contractOwner.account.address);
    sameAddress(await wakeStake.read.admin(), contractOwner.account.address);
    await viem.assertions.revertWith(
      wakeStake.write.setFeePayoutAddress([newFeeCollector.account.address], {
        account: owner.account,
      }),
      "only the admin can change the fee payout address",
    );

    await viem.assertions.emitWithArgs(
      wakeStake.write.setFeePayoutAddress([newFeeCollector.account.address], {
        account: contractOwner.account,
      }),
      wakeStake,
      "FeePayoutAddressChanged",
      [newFeeCollector.account.address],
    );
    sameAddress(await wakeStake.read.feePayoutAddress(), newFeeCollector.account.address);
  });

  it("admin is whoever owns admin.wakestake.eth, so transferring the name hands over admin", async function () {
    const { wakeStake, wakeStakeRegistry } = await setup();
    const adminTokenId = await wakeStakeRegistry.read.findTokenId(["admin"]);

    // the deployer keeps root roles (e.g. unregister) on the wakestake.eth registry, so it isn't emancipated
    // and ENS refuses safeTransferFrom there. unsafeTransfer moves the name and its roles all the same.
    await viem.assertions.revertWithCustomError(
      wakeStakeRegistry.write.safeTransferFrom(
        [contractOwner.account.address, owner.account.address, adminTokenId, 1n, "0x"],
        { account: contractOwner.account },
      ),
      wakeStakeRegistry,
      "TransferUnsafeUntilRegistryIsEmancipated",
    );
    await wakeStakeRegistry.write.unsafeTransfer([owner.account.address, adminTokenId, "0x"], {
      account: contractOwner.account,
    });

    sameAddress(await wakeStake.read.admin(), owner.account.address);
    await viem.assertions.revertWith(
      wakeStake.write.setFeePayoutAddress([newFeeCollector.account.address], {
        account: contractOwner.account,
      }),
      "only the admin can change the fee payout address",
    );
    await viem.assertions.emitWithArgs(
      wakeStake.write.setFeePayoutAddress([newFeeCollector.account.address], {
        account: owner.account,
      }),
      wakeStake,
      "FeePayoutAddressChanged",
      [newFeeCollector.account.address],
    );
    sameAddress(await wakeStake.read.feePayoutAddress(), newFeeCollector.account.address);
  });
});
