import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

import WakeStakeModule from "../ignition/modules/WakeStake.js";

describe("WakeStake", async function () {
  const { viem, ignition, networkHelpers } = await network.create();
  const [, alice, bob] = await viem.getWalletClients();

  async function deployFixture() {
    const { wakeStake } = await ignition.deploy(WakeStakeModule);
    const token = await viem.deployContract("MockERC20", ["Mock", "MCK"]);
    return { wakeStake, token };
  }

  it("lets a user stake tokens and withdraw them", async function () {
    const { wakeStake, token } = await networkHelpers.loadFixture(deployFixture);
    const amount = 100n * 10n ** 18n;
    const hashedSecrets = 1234n;

    await token.write.mint([alice.account.address, amount]);

    // stake: approve first, then the contract pulls the tokens in
    await token.write.approve([wakeStake.address, amount], {
      account: alice.account,
    });
    await wakeStake.write.stake([token.address, amount, hashedSecrets], {
      account: alice.account,
    });

    assert.equal(await token.read.balanceOf([alice.account.address]), 0n);
    assert.equal(await token.read.balanceOf([wakeStake.address]), amount);

    // with a single leaf, the LeanIMT root equals that leaf
    const [leaf] = await wakeStake.read.getLeaves([0n, 1n]);
    assert.notEqual(leaf, 0n);
    const root = leaf;

    // withdraw to a different recipient; the proof is not verified yet
    const now = BigInt(await networkHelpers.time.latest());
    const nullifier = 42n;
    await wakeStake.write.withdraw(
      [
        bob.account.address,
        token.address,
        amount,
        root,
        nullifier,
        now - 1n,
        now + 3600n,
        "0x",
      ],
      { account: alice.account },
    );

    assert.equal(await token.read.balanceOf([wakeStake.address]), 0n);
    assert.equal(await token.read.balanceOf([bob.account.address]), amount);
  });
});
