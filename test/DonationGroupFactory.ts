// DonationGroupFactory, and how it hands out ENSv2 names with Enhanced Access Control.
// Runs against ENS's real registry contracts from the lib/contracts-v2 submodule.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { labelhash, hexToBigInt, zeroAddress, type Address } from "viem";

import { ENS_ROLES } from "../src/constants.js";
import { createWakeStakeTestContext, GROUP_LABEL, STAKE_AMOUNT } from "./helpers/wakeStakeTestContext.js";

describe("DonationGroupFactory", async function () {
  const {
    viem,
    setup,
    wallets: { contractOwner, groupAdmin, groupMember, charity, ownerRecipient },
  } = await createWakeStakeTestContext();

  const sameAddress = (actual: Address, expected: Address) => assert.equal(actual.toLowerCase(), expected.toLowerCase());
  const labelId = (label: string) => hexToBigInt(labelhash(label));

  it("the creator becomes admin and the group stores its settings", async function () {
    const { wakeStake, stakeOwnershipVerifier, token, donationGroup } = await setup();

    sameAddress(await donationGroup.read.admin(), groupAdmin.account.address);
    sameAddress(await donationGroup.read.donationAddress(), charity.account.address);
    sameAddress(await donationGroup.read.stakeToken(), token.address);
    assert.equal(await donationGroup.read.minStakeAmount(), STAKE_AMOUNT);
    assert.equal(await donationGroup.read.label(), GROUP_LABEL);
    // set once on the implementation, shared by every clone
    sameAddress(await donationGroup.read.wakeStake(), wakeStake.address);
    sameAddress(await donationGroup.read.stakeOwnershipVerifier(), stakeOwnershipVerifier.address);
  });

  describe("ENS names", function () {
    it("names the group <label>.wakestake.eth and gives the creator admin.<label>.wakestake.eth", async function () {
      const { wakeStakeRegistry, donationGroup, groupRegistry } = await setup();

      // <label>.wakestake.eth is owned by the group and points to the group's own registry
      sameAddress(await wakeStakeRegistry.read.findOwner([GROUP_LABEL]), donationGroup.address);
      sameAddress(await wakeStakeRegistry.read.getSubregistry([GROUP_LABEL]), groupRegistry.address);
      assert.equal(await wakeStakeRegistry.read.findExpiry([GROUP_LABEL]), 2n ** 64n - 1n);
      // which knows its canonical name
      const [parent, childLabel] = await groupRegistry.read.getParent();
      sameAddress(parent, wakeStakeRegistry.address);
      assert.equal(childLabel, GROUP_LABEL);

      // admin.<label>.wakestake.eth is owned by the creator, with the roles the group gives it
      sameAddress(await groupRegistry.read.findOwner(["admin"]), groupAdmin.account.address);
      assert.equal(
        await groupRegistry.read.roles([labelId("admin"), groupAdmin.account.address]),
        await donationGroup.read.ADMIN_NAME_ROLES(),
      );
    });

    it("only the factory can hand out <label>.wakestake.eth, so only factory-made groups get a name", async function () {
      const { wakeStakeRegistry, donationGroupFactory } = await setup();

      assert.equal(
        await wakeStakeRegistry.read.hasRootRoles([ENS_ROLES.REGISTRAR, donationGroupFactory.address]),
        true,
      );
      // not even the WakeStake deployer, who owns wakestake.eth and granted the factory that role, registers directly
      for (const account of [groupAdmin, groupMember]) {
        assert.equal(await wakeStakeRegistry.read.hasRootRoles([ENS_ROLES.REGISTRAR, account.account.address]), false);
        await viem.assertions.revertWithCustomError(
          wakeStakeRegistry.write.register(
            ["fakegroup", account.account.address, zeroAddress, zeroAddress, 0n, 2n ** 64n - 1n],
            { account: account.account },
          ),
          wakeStakeRegistry,
          "EACUnauthorizedAccountRoles",
        );
      }
    });

    it("only the group can register names in its registry, and can't take them back", async function () {
      const { donationGroupFactory, donationGroup, groupRegistry } = await setup();

      assert.equal(
        await groupRegistry.read.roles([0n, donationGroup.address]),
        await donationGroupFactory.read.GROUP_REGISTRY_ROLES(),
      );
      // the group holds no unregister, subregistry, resolver or upgrade role, so ENS calls the registry emancipated
      assert.equal(await groupRegistry.read.isEmancipated(), true);
      await viem.assertions.revertWithCustomError(
        groupRegistry.write.register(
          ["mallory", groupAdmin.account.address, zeroAddress, zeroAddress, 0n, 2n ** 64n - 1n],
          { account: groupAdmin.account },
        ),
        groupRegistry,
        "EACUnauthorizedAccountRoles",
      );
    });

    it("the group's own name can't be transferred away from it", async function () {
      const { wakeStakeRegistry, donationGroup } = await setup();

      assert.equal(await wakeStakeRegistry.read.roles([labelId(GROUP_LABEL), donationGroup.address]), 0n);
    });

    it("rejects a group name that is taken", async function () {
      const { donationGroupFactory, token } = await setup();

      await viem.assertions.revertWith(
        donationGroupFactory.write.createDonationGroup([GROUP_LABEL, charity.account.address, token.address, 1n], {
          account: groupMember.account,
        }),
        "group name is taken",
      );
    });
  });

  it("creates a separate clone and registry per group and emits DonationGroupCreated", async function () {
    const { donationGroupFactory, wakeStakeRegistry, donationGroup, groupRegistry, token } = await setup();
    const createArgs = ["earlybirds", ownerRecipient.account.address, token.address, 1n] as const;

    const { result: otherGroupAddress } = await donationGroupFactory.simulate.createDonationGroup(createArgs, {
      account: groupMember.account.address,
    });
    await donationGroupFactory.write.createDonationGroup(createArgs, { account: groupMember.account });

    const otherGroup = await viem.getContractAt("DonationGroup", otherGroupAddress);
    const otherRegistry = await otherGroup.read.registry();
    const [createdEvent] = await donationGroupFactory.getEvents.DonationGroupCreated({ donationGroup: otherGroupAddress });
    sameAddress(createdEvent.args.donationAddress!, ownerRecipient.account.address);
    sameAddress(createdEvent.args.admin!, groupMember.account.address);
    assert.equal(createdEvent.args.label, "earlybirds");
    sameAddress(createdEvent.args.registry!, otherRegistry);

    assert.notEqual(otherGroupAddress.toLowerCase(), donationGroup.address.toLowerCase());
    assert.notEqual(otherRegistry.toLowerCase(), groupRegistry.address.toLowerCase());
    sameAddress(await otherGroup.read.admin(), groupMember.account.address);
    sameAddress(await wakeStakeRegistry.read.findOwner(["earlybirds"]), otherGroupAddress);
    // the first group is untouched
    sameAddress(await donationGroup.read.admin(), groupAdmin.account.address);
    sameAddress(await donationGroup.read.donationAddress(), charity.account.address);
  });

  it("neither a clone nor the implementation can be initialized again", async function () {
    const { donationGroupFactory, donationGroup, groupRegistry, wakeStakeRegistry, token } = await setup();
    const implementation = await viem.getContractAt("DonationGroup", await donationGroupFactory.read.implementation());
    // taking over a group would redirect its lost stakes
    const takeoverArgs = [
      groupMember.account.address,
      groupMember.account.address,
      token.address,
      0n,
      groupRegistry.address,
      wakeStakeRegistry.address,
      "takeover",
    ] as const;

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
      donationGroupFactory.write.createDonationGroup(["zerogroup", zeroAddress, token.address, STAKE_AMOUNT], {
        account: contractOwner.account,
      }),
      "donation address cannot be zero",
    );
  });
});
