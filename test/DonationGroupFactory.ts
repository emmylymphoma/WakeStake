import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { zeroAddress, type Address } from "viem";

import { createWakeStakeTestContext, STAKE_AMOUNT } from "./helpers/wakeStakeTestContext.js";

describe("DonationGroupFactory", async function () {
  const {
    viem,
    setup,
    wallets: { contractOwner, groupAdmin, groupMember, charity, ownerRecipient },
  } = await createWakeStakeTestContext();

  const sameAddress = (actual: Address, expected: Address) => assert.equal(actual.toLowerCase(), expected.toLowerCase());

  it("the creator becomes admin and the group stores its settings", async function () {
    const { wakeStake, stakeOwnershipVerifier, token, donationGroup } = await setup();

    sameAddress(await donationGroup.read.admin(), groupAdmin.account.address);
    sameAddress(await donationGroup.read.donationAddress(), charity.account.address);
    sameAddress(await donationGroup.read.stakeToken(), token.address);
    assert.equal(await donationGroup.read.minStakeAmount(), STAKE_AMOUNT);
    // set once on the implementation, shared by every clone
    sameAddress(await donationGroup.read.wakeStake(), wakeStake.address);
    sameAddress(await donationGroup.read.stakeOwnershipVerifier(), stakeOwnershipVerifier.address);
  });

  it("creates a separate clone per group and emits DonationGroupCreated", async function () {
    const { donationGroupFactory, donationGroup, token } = await setup();
    const createArgs = [ownerRecipient.account.address, token.address, 1n] as const;

    const { result: otherGroupAddress } = await donationGroupFactory.simulate.createDonationGroup(createArgs, {
      account: groupMember.account.address,
    });
    await viem.assertions.emitWithArgs(
      donationGroupFactory.write.createDonationGroup(createArgs, { account: groupMember.account }),
      donationGroupFactory,
      "DonationGroupCreated",
      [otherGroupAddress, ownerRecipient.account.address, groupMember.account.address],
    );

    const otherGroup = await viem.getContractAt("DonationGroup", otherGroupAddress);
    assert.notEqual(otherGroupAddress.toLowerCase(), donationGroup.address.toLowerCase());
    sameAddress(await otherGroup.read.admin(), groupMember.account.address);
    sameAddress(await otherGroup.read.donationAddress(), ownerRecipient.account.address);
    // the first group is untouched
    sameAddress(await donationGroup.read.admin(), groupAdmin.account.address);
    sameAddress(await donationGroup.read.donationAddress(), charity.account.address);
  });

  it("neither a clone nor the implementation can be initialized again", async function () {
    const { donationGroupFactory, donationGroup, token } = await setup();
    const implementation = await viem.getContractAt("DonationGroup", await donationGroupFactory.read.implementation());
    // taking over a group would redirect its lost stakes
    const takeoverArgs = [groupMember.account.address, groupMember.account.address, token.address, 0n] as const;

    for (const group of [donationGroup, implementation]) {
      await viem.assertions.revertWithCustomError(
        group.write.initialize(takeoverArgs, { account: groupMember.account }),
        group,
        "InvalidInitialization",
      );
    }
  });

  it("rejects a zero donation address", async function () {
    const { donationGroupFactory, token } = await setup();

    await viem.assertions.revertWith(
      donationGroupFactory.write.createDonationGroup([zeroAddress, token.address, STAKE_AMOUNT], {
        account: contractOwner.account,
      }),
      "donation address cannot be zero",
    );
  });
});
