// DonationGroup with real stake_ownership proofs. Factory behaviour is in test/DonationGroupFactory.ts.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  executeStakeOwnershipCircuit,
  generateStakeOwnershipProof,
  stakeOwnershipPublicInputs,
} from "../src/circuit.js";
import { zeroAddress, type Address } from "viem";

import { DAY, HOUR } from "../src/constants.js";
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

  it("admin adds a member, who registers a name and votes with a real proof", async function () {
    const { donationGroup, publicValues, proof } = await stakeToGroupAndProve();
    const { root, nullifier } = publicValues;

    assert.equal((await donationGroup.read.admin()).toLowerCase(), groupAdmin.account.address.toLowerCase());
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
    // voting uses the same kind of proof
    await viem.assertions.emitWithArgs(
      donationGroup.write.voteDonationAddress([charity.account.address, root, nullifier, proof], { account: owner.account }),
      donationGroup,
      "DonationAddressVoted",
      [owner.account.address, charity.account.address, 1n],
    );
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
      donationGroup.write.voteDonationAddress([charity.account.address, root + 1n, nullifier, proof], { account: owner.account }),
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
    await networkHelpers.time.increase(HOUR);
    await wake(stakedNote, DAY);
    await viem.assertions.revertWith(
      donationGroup.write.voteDonationAddress([charity.account.address, root, nullifier, proof], { account: owner.account }),
      "stake was already withdrawn or woken up",
    );
  });

  describe("voting on the donation address and minimum stake", function () {
    /** Five members each stake to the group and get added by the admin. `proofFor(i)` proves member i's stake. */
    async function fiveStakingMembers() {
      const context = await setup({ donateTo: "donationGroup" });
      const { donationGroup, stake, syncMerkleTree } = context;
      const members = [owner, ...extraStakers];
      const notes: NoteWithSecret[] = [];
      for (const member of members) {
        notes.push(await stake(DAY, member));
        await donationGroup.write.addMember([member.account.address], { account: groupAdmin.account });
      }
      const merkleTree = await syncMerkleTree();

      /** [root, nullifier, proof] for member i, against the group's current minimum */
      async function proofFor(memberIndex: number) {
        const { publicValues, proof } = await generateStakeOwnershipProof(stakeOwnershipCircuit, {
          merkleTree,
          ...notes[memberIndex],
          minAmount: await donationGroup.read.minStakeAmount(),
          claimer: members[memberIndex].account.address,
        });
        return [publicValues.root, publicValues.nullifier, proof] as const;
      }
      return { ...context, members, proofFor };
    }

    it("switches the donation address instantly once 3 of 5 members vote for it", async function () {
      const { donationGroup, members, proofFor } = await fiveStakingMembers();
      const newCause = ownerRecipient.account.address;
      assert.equal(await donationGroup.read.memberCount(), 5n);

      // 2 of 5 is not a majority
      for (const [memberIndex, expectedVotes] of [[0, 1n], [1, 2n]] as const) {
        await viem.assertions.emitWithArgs(
          donationGroup.write.voteDonationAddress([newCause, ...(await proofFor(memberIndex))], {
            account: members[memberIndex].account,
          }),
          donationGroup,
          "DonationAddressVoted",
          [members[memberIndex].account.address, newCause, expectedVotes],
        );
      }
      sameAddress(await donationGroup.read.donationAddress(), charity.account.address);

      // the third vote is
      await viem.assertions.emitWithArgs(
        donationGroup.write.voteDonationAddress([newCause, ...(await proofFor(2))], { account: members[2].account }),
        donationGroup,
        "DonationAddressChanged",
        [newCause],
      );
      sameAddress(await donationGroup.read.donationAddress(), newCause);
    });

    it("a member voting again moves their vote instead of adding one", async function () {
      const { donationGroup, members, proofFor } = await fiveStakingMembers();
      const firstChoice = ownerRecipient.account.address;
      const secondChoice = groupMember.account.address;
      const proof = await proofFor(0);
      const asMember = { account: members[0].account };

      await donationGroup.write.voteDonationAddress([firstChoice, ...proof], asMember);
      await donationGroup.write.voteDonationAddress([secondChoice, ...proof], asMember);
      await donationGroup.write.voteDonationAddress([secondChoice, ...proof], asMember);

      assert.equal(await donationGroup.read.donationAddressVotes([firstChoice]), 0n);
      assert.equal(await donationGroup.read.donationAddressVotes([secondChoice]), 1n);
      sameAddress(await donationGroup.read.donationAddressVoteOf([members[0].account.address]), secondChoice);
      await viem.assertions.revertWith(
        donationGroup.write.voteDonationAddress([zeroAddress, ...proof], asMember),
        "donation address cannot be zero",
      );
    });

    it("lowers the minimum stake once 3 of 5 vote for it, and old proofs stop working", async function () {
      const { donationGroup, members, proofFor } = await fiveStakingMembers();
      const lowerMinimum = STAKE_AMOUNT / 2n;
      // made for the old minimum, which is one of the proof's public inputs
      const staleProof = await proofFor(3);

      for (const memberIndex of [0, 1]) {
        await donationGroup.write.voteMinStakeAmount([lowerMinimum, ...(await proofFor(memberIndex))], {
          account: members[memberIndex].account,
        });
      }
      assert.equal(await donationGroup.read.minStakeAmount(), STAKE_AMOUNT);
      await viem.assertions.emitWithArgs(
        donationGroup.write.voteMinStakeAmount([lowerMinimum, ...(await proofFor(2))], { account: members[2].account }),
        donationGroup,
        "MinStakeAmountChanged",
        [lowerMinimum],
      );
      assert.equal(await donationGroup.read.minStakeAmount(), lowerMinimum);

      await assert.rejects(
        donationGroup.write.registerName(["dave", ...staleProof], { account: members[3].account }),
      );
      await viem.assertions.emitWithArgs(
        donationGroup.write.registerName(["dave", ...(await proofFor(3))], { account: members[3].account }),
        donationGroup,
        "NewMember",
        [members[3].account.address, "dave"],
      );
    });

    it("adding the same member twice is rejected, so the member count stays honest", async function () {
      const { donationGroup } = await setup();
      await donationGroup.write.addMember([groupMember.account.address], { account: groupAdmin.account });

      await viem.assertions.revertWith(
        donationGroup.write.addMember([groupMember.account.address], { account: groupAdmin.account }),
        "already a member",
      );
      assert.equal(await donationGroup.read.memberCount(), 1n);
    });
  });
});
