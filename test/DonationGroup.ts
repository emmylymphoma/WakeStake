// DonationGroup with real stake_ownership proofs. Factory behaviour is in test/DonationGroupFactory.ts.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  executeStakeOwnershipCircuit,
  generateStakeOwnershipProof,
  stakeOwnershipPublicInputs,
} from "../src/circuit.js";
import { hexToBigInt, labelhash, zeroAddress, type Address } from "viem";

import { DAY, ENS_ROLES, HOUR } from "../src/constants.js";
import { addressToField, type NoteWithSecret } from "../src/note.js";
import {
  createWakeStakeTestContext,
  STAKE_AMOUNT,
  stakeOwnershipCircuit,
} from "./helpers/wakeStakeTestContext.js";

describe("DonationGroup", async function () {
  const {
    viem,
    networkHelpers,
    setup,
    wallets: { contractOwner, owner, ownerRecipient, groupMember, groupAdmin, charity, extraStakers },
  } = await createWakeStakeTestContext();

  const sameAddress = (actual: Address, expected: Address) => assert.equal(actual.toLowerCase(), expected.toLowerCase());

  /** Owner stakes to the group, and proves they own that stake with the group's minimum. */
  async function stakeToGroupAndProve() {
    const context = await setup({ donateTo: "donationGroup" });
    const stakedNote = await context.stake(DAY);
    const ownershipProof = await generateStakeOwnershipProof(stakeOwnershipCircuit, {
      merkleTree: await context.syncMerkleTree(),
      ...stakedNote,
      minAmount: await context.donationGroup.read.minStakeAmount(),
      claimer: owner.account.address,
    });
    return { ...context, stakedNote, ...ownershipProof };
  }

  describe("stake ownership proof", function () {
    it("owner proves an unspent stake of at least the minimum that donates to their group", async function () {
      const { wakeStake, stakeOwnershipVerifier, donationGroup, wake, stakedNote, publicValues, publicInputs, proof } =
        await stakeToGroupAndProve();

      // the group's minimum is exactly the stake, which is enough
      assert.equal(publicValues.minAmount, STAKE_AMOUNT);
      assert.equal(await stakeOwnershipVerifier.read.verify([proof, publicInputs]), true);
      assert.equal(publicValues.donationAddress, addressToField(donationGroup.address));
      // the checks a group contract does next to the proof
      assert.equal(await wakeStake.read.rootHistory([publicValues.root]), true);
      assert.equal(await wakeStake.read.nullifiers([publicValues.nullifier]), false);

      // the proof only works for its claimer (the verifier reverts or returns false on a bad proof)
      const stolenPublicInputs = stakeOwnershipPublicInputs({
        ...publicValues,
        claimer: addressToField(groupMember.account.address),
      });
      assert.equal(await stakeOwnershipVerifier.read.verify([proof, stolenPublicInputs]).catch(() => false), false);

      // after wake() the old commitment's nullifier is spent
      await networkHelpers.time.increase(HOUR);
      await wake(stakedNote, DAY);
      assert.equal(await wakeStake.read.nullifiers([publicValues.nullifier]), true);
    });

    it("can't prove a stake below the minimum or without the owner's secret", async function () {
      const { stake, syncMerkleTree } = await setup({ donateTo: "donationGroup" });
      const stakedNote = await stake(DAY);
      const inputs = {
        merkleTree: await syncMerkleTree(),
        ...stakedNote,
        minAmount: STAKE_AMOUNT,
        claimer: owner.account.address,
      };

      await assert.rejects(
        executeStakeOwnershipCircuit(stakeOwnershipCircuit, { ...inputs, minAmount: STAKE_AMOUNT + 1n }),
        /stake amount is below min_amount/,
      );
      // group members know every secret except `secret`
      await assert.rejects(
        executeStakeOwnershipCircuit(stakeOwnershipCircuit, { ...inputs, secret: 0n }),
        /you need to know the secret/,
      );
    });
  });


  const nameId = (name: string) => hexToBigInt(labelhash(name));
  const PERMANENT = 2n ** 64n - 1n;

  it("admin adds a member, who registers <name>.<label>.wakestake.eth and votes with it", async function () {
    const { donationGroup, groupRegistry, publicValues, proof } = await stakeToGroupAndProve();
    const { root, nullifier } = publicValues;

    await viem.assertions.emitWithArgs(
      donationGroup.write.addMember([owner.account.address], { account: groupAdmin.account }),
      donationGroup,
      "MemberAdded",
      [owner.account.address],
    );
    await viem.assertions.emitWithArgs(
      donationGroup.write.registerName(["alice", root, nullifier, proof], { account: owner.account }),
      donationGroup,
      "NewMember",
      [owner.account.address, "alice"],
    );

    // a real ENSv2 name in the group's registry: permanent, transferable, with its own resolver rights
    sameAddress(await groupRegistry.read.findOwner(["alice"]), owner.account.address);
    assert.equal(await groupRegistry.read.findExpiry(["alice"]), PERMANENT);
    assert.equal(
      await groupRegistry.read.roles([nameId("alice"), owner.account.address]),
      await donationGroup.read.NAME_ROLES(),
    );
    assert.equal(await donationGroup.read.isMemberName([nameId("alice")]), true);
    assert.equal(await donationGroup.read.memberCount(), 1n);

    // voting uses the same kind of proof, and the name
    await viem.assertions.emitWithArgs(
      donationGroup.write.voteDonationAddress(["alice", charity.account.address, root, nullifier, proof], {
        account: owner.account,
      }),
      donationGroup,
      "DonationAddressVoted",
      [owner.account.address, "alice", charity.account.address, 1n],
    );
  });

  it("registers one name per member, and rejects taken names like admin", async function () {
    const { donationGroup, groupRegistry, publicValues, proof } = await stakeToGroupAndProve();
    const proofArgs = [publicValues.root, publicValues.nullifier, proof] as const;
    await donationGroup.write.addMember([owner.account.address], { account: groupAdmin.account });

    await viem.assertions.revertWithCustomError(
      donationGroup.write.registerName(["admin", ...proofArgs], { account: owner.account }),
      groupRegistry,
      "LabelAlreadyRegistered",
    );
    await donationGroup.write.registerName(["alice", ...proofArgs], { account: owner.account });
    await viem.assertions.revertWith(
      donationGroup.write.registerName(["alice2", ...proofArgs], { account: owner.account }),
      "already registered a name",
    );
    assert.equal(await donationGroup.read.memberCount(), 1n);
  });

  it("only the group admin can add members, not the WakeStake deployer", async function () {
    const { donationGroup } = await setup();

    for (const notAdmin of [groupMember, contractOwner]) {
      await viem.assertions.revertWith(
        donationGroup.write.addMember([groupMember.account.address], { account: notAdmin.account }),
        "only the group admin can add members",
      );
    }
    assert.equal(await donationGroup.read.isMember([groupMember.account.address]), false);
  });

  it("admin is whoever owns admin.<label>.wakestake.eth, so transferring the name hands over admin", async function () {
    const { donationGroup, groupRegistry } = await setup();
    const adminTokenId = await groupRegistry.read.findTokenId(["admin"]);

    // a plain ERC1155 transfer of the ENS name, allowed because the name has ROLE_CAN_TRANSFER_ADMIN
    await groupRegistry.write.safeTransferFrom(
      [groupAdmin.account.address, groupMember.account.address, adminTokenId, 1n, "0x"],
      { account: groupAdmin.account },
    );

    sameAddress(await donationGroup.read.admin(), groupMember.account.address);
    // the name's Enhanced Access Control roles moved with it
    for (const [account, hasRole] of [[groupMember, true], [groupAdmin, false]] as const) {
      assert.equal(
        await groupRegistry.read.hasRoles([nameId("admin"), ENS_ROLES.CAN_TRANSFER_ADMIN, account.account.address]),
        hasRole,
      );
    }
    await viem.assertions.revertWith(
      donationGroup.write.addMember([owner.account.address], { account: groupAdmin.account }),
      "only the group admin can add members",
    );
    await viem.assertions.emitWithArgs(
      donationGroup.write.addMember([owner.account.address], { account: groupMember.account }),
      donationGroup,
      "MemberAdded",
      [owner.account.address],
    );
  });

  it("formats public inputs in the same order as the circuit and src/circuit.ts", async function () {
    const { donationGroup, publicValues, publicInputs } = await stakeToGroupAndProve();

    const contractPublicInputs = await donationGroup.read.formatStakeOwnershipPublicInputs([
      publicValues.root,
      publicValues.nullifier,
      owner.account.address,
    ]);
    assert.deepEqual(
      contractPublicInputs.map((input) => input.toLowerCase()),
      publicInputs.map((input) => input.toLowerCase()),
    );
  });

  it("rejects a valid proof from someone the admin didn't add, or with an unknown root", async function () {
    const { donationGroup, publicValues, proof } = await stakeToGroupAndProve();
    const { root, nullifier } = publicValues;

    await viem.assertions.revertWith(
      donationGroup.write.registerName(["alice", root, nullifier, proof], { account: owner.account }),
      "not added by the group admin",
    );

    await donationGroup.write.addMember([owner.account.address], { account: groupAdmin.account });
    await viem.assertions.revertWith(
      donationGroup.write.registerName(["alice", root + 1n, nullifier, proof], { account: owner.account }),
      "root provided has not existed in WakeStake",
    );
  });

  it("rejects a proof sent by another member, and a proof whose stake woke up since", async function () {
    const { donationGroup, stakeOwnershipVerifier, wake, stakedNote, publicValues, proof } =
      await stakeToGroupAndProve();
    const { root, nullifier } = publicValues;
    for (const member of [owner, groupMember]) {
      await donationGroup.write.addMember([member.account.address], { account: groupAdmin.account });
    }

    // groupMember copies the owner's proof, but it was made for the owner
    await viem.assertions.revertWithCustomError(
      donationGroup.write.registerName(["mallory", root, nullifier, proof], { account: groupMember.account }),
      stakeOwnershipVerifier,
      "SumcheckFailed",
    );

    // wake() spends the stake's nullifier, so the owner has to prove again with their new stake
    await donationGroup.write.registerName(["alice", root, nullifier, proof], { account: owner.account });
    await networkHelpers.time.increase(HOUR);
    await wake(stakedNote, DAY);
    await viem.assertions.revertWith(
      donationGroup.write.voteDonationAddress(["alice", charity.account.address, root, nullifier, proof], {
        account: owner.account,
      }),
      "stake was already withdrawn or woken up",
    );
  });

  describe("voting on the donation address and minimum stake", function () {
    const NAMES = ["alice", "bob", "carol", "dave", "erin"];

    /**
     * Five members each stake to the group, get added by the admin, and register NAMES[i].
     * `proofFor(i)` proves member i's stake against the group's current minimum.
     */
    async function fiveMembersWithNames() {
      const context = await setup({ donateTo: "donationGroup" });
      const { donationGroup, stake, syncMerkleTree } = context;
      const members = [owner, ...extraStakers];
      const notes: NoteWithSecret[] = [];
      for (const member of members) {
        notes.push(await stake(DAY, member));
        await donationGroup.write.addMember([member.account.address], { account: groupAdmin.account });
      }
      const merkleTree = await syncMerkleTree();

      /** [root, nullifier, proof] for member i */
      async function proofFor(memberIndex: number) {
        const { publicValues, proof } = await generateStakeOwnershipProof(stakeOwnershipCircuit, {
          merkleTree,
          ...notes[memberIndex],
          minAmount: await donationGroup.read.minStakeAmount(),
          claimer: members[memberIndex].account.address,
        });
        return [publicValues.root, publicValues.nullifier, proof] as const;
      }
      for (const [memberIndex, member] of members.entries()) {
        await donationGroup.write.registerName([NAMES[memberIndex], ...(await proofFor(memberIndex))], {
          account: member.account,
        });
      }
      return { ...context, members, proofFor };
    }

    it("switches the donation address instantly once 3 of 5 names vote for it", async function () {
      const { donationGroup, members, proofFor } = await fiveMembersWithNames();
      const newCause = ownerRecipient.account.address;
      assert.equal(await donationGroup.read.memberCount(), 5n);

      // 2 of 5 is not a majority
      for (const [memberIndex, expectedVotes] of [[0, 1n], [1, 2n]] as const) {
        await viem.assertions.emitWithArgs(
          donationGroup.write.voteDonationAddress([NAMES[memberIndex], newCause, ...(await proofFor(memberIndex))], {
            account: members[memberIndex].account,
          }),
          donationGroup,
          "DonationAddressVoted",
          [members[memberIndex].account.address, NAMES[memberIndex], newCause, expectedVotes],
        );
      }
      sameAddress(await donationGroup.read.donationAddress(), charity.account.address);

      // the third vote is
      await viem.assertions.emitWithArgs(
        donationGroup.write.voteDonationAddress([NAMES[2], newCause, ...(await proofFor(2))], {
          account: members[2].account,
        }),
        donationGroup,
        "DonationAddressChanged",
        [newCause],
      );
      sameAddress(await donationGroup.read.donationAddress(), newCause);
    });

    it("voting again with a name moves its vote instead of adding one", async function () {
      const { donationGroup, members, proofFor } = await fiveMembersWithNames();
      const firstChoice = ownerRecipient.account.address;
      const secondChoice = groupMember.account.address;
      const proof = await proofFor(0);
      const asMember = { account: members[0].account };

      await donationGroup.write.voteDonationAddress(["alice", firstChoice, ...proof], asMember);
      await donationGroup.write.voteDonationAddress(["alice", secondChoice, ...proof], asMember);
      await donationGroup.write.voteDonationAddress(["alice", secondChoice, ...proof], asMember);

      assert.equal(await donationGroup.read.donationAddressVotes([firstChoice]), 0n);
      assert.equal(await donationGroup.read.donationAddressVotes([secondChoice]), 1n);
      sameAddress(await donationGroup.read.donationAddressVoteOf([nameId("alice")]), secondChoice);
      await viem.assertions.revertWith(
        donationGroup.write.voteDonationAddress(["alice", zeroAddress, ...proof], asMember),
        "donation address cannot be zero",
      );
    });

    it("votes belong to the name: after a transfer only the new owner can move its vote", async function () {
      const { donationGroup, groupRegistry, members, proofFor } = await fiveMembersWithNames();
      const [alice, bob] = members;
      const firstChoice = ownerRecipient.account.address;
      const secondChoice = groupMember.account.address;
      await donationGroup.write.voteDonationAddress(["alice", firstChoice, ...(await proofFor(0))], {
        account: alice.account,
      });

      await groupRegistry.write.safeTransferFrom(
        [alice.account.address, bob.account.address, await groupRegistry.read.findTokenId(["alice"]), 1n, "0x"],
        { account: alice.account },
      );

      // the old owner can't vote with it anymore, the new owner moves its existing vote
      await viem.assertions.revertWith(
        donationGroup.write.voteDonationAddress(["alice", secondChoice, ...(await proofFor(0))], {
          account: alice.account,
        }),
        "you don't own this name",
      );
      await donationGroup.write.voteDonationAddress(["alice", secondChoice, ...(await proofFor(1))], {
        account: bob.account,
      });
      assert.equal(await donationGroup.read.donationAddressVotes([firstChoice]), 0n);
      assert.equal(await donationGroup.read.donationAddressVotes([secondChoice]), 1n);
      assert.equal(await donationGroup.read.memberCount(), 5n);

      // the admin name isn't a member name, so it has no vote
      await viem.assertions.revertWith(
        donationGroup.write.voteDonationAddress(["admin", secondChoice, ...(await proofFor(1))], {
          account: groupAdmin.account,
        }),
        "not a member name of this group",
      );
    });

    it("lowers the minimum stake once 3 of 5 vote for it, and old proofs stop working", async function () {
      const { donationGroup, members, proofFor } = await fiveMembersWithNames();
      const lowerMinimum = STAKE_AMOUNT / 2n;
      // made for the old minimum, which is one of the proof's public inputs
      const staleProof = await proofFor(3);

      for (const memberIndex of [0, 1]) {
        await donationGroup.write.voteMinStakeAmount([NAMES[memberIndex], lowerMinimum, ...(await proofFor(memberIndex))], {
          account: members[memberIndex].account,
        });
      }
      assert.equal(await donationGroup.read.minStakeAmount(), STAKE_AMOUNT);
      await viem.assertions.emitWithArgs(
        donationGroup.write.voteMinStakeAmount([NAMES[2], lowerMinimum, ...(await proofFor(2))], {
          account: members[2].account,
        }),
        donationGroup,
        "MinStakeAmountChanged",
        [lowerMinimum],
      );
      assert.equal(await donationGroup.read.minStakeAmount(), lowerMinimum);

      await assert.rejects(
        donationGroup.write.voteMinStakeAmount([NAMES[3], lowerMinimum, ...staleProof], { account: members[3].account }),
      );
      await viem.assertions.emitWithArgs(
        donationGroup.write.voteMinStakeAmount([NAMES[3], lowerMinimum, ...(await proofFor(3))], {
          account: members[3].account,
        }),
        donationGroup,
        "MinStakeAmountVoted",
        [members[3].account.address, NAMES[3], lowerMinimum, 4n],
      );
    });

    it("adding the same member twice is rejected", async function () {
      const { donationGroup } = await setup();
      await donationGroup.write.addMember([groupMember.account.address], { account: groupAdmin.account });

      await viem.assertions.revertWith(
        donationGroup.write.addMember([groupMember.account.address], { account: groupAdmin.account }),
        "already a member",
      );
      assert.equal(await donationGroup.read.isMember([groupMember.account.address]), true);
    });
  });
});
