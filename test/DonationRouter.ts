import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { CompiledCircuit } from "@noir-lang/noir_js";
import { network } from "hardhat";
import { createPublicClient, http, type Address } from "viem";

import WakeStakeModule from "../ignition/modules/WakeStake.js";
import { createTimestampWindow, generateProof } from "../src/circuit.js";
import { DAY, HOUR } from "../src/constants.js";
import { fetchMerkleTree } from "../src/merkleTree.js";
import { addressToField, createNote, noteAllSecretsHash } from "../src/note.js";
import { createPoolWithLiquidity, POOL_FEE, quoteExactInputSingle, UNISWAP_SEPOLIA } from "../src/uniswap.js";

// Runs against the real Uniswap v3 contracts on a local fork of Sepolia.
// FORK_URL overrides the RPC. Free RPCs only keep recent state, so the fork starts a few blocks
// behind the tip (Hardhat's own default is further back than they keep). FORK_BLOCK pins one instead.
const FORK_URL = process.env.FORK_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const FORK_BLOCK = process.env.FORK_BLOCK
  ? BigInt(process.env.FORK_BLOCK)
  : (await createPublicClient({ transport: http(FORK_URL) }).getBlockNumber()) - 5n;

const compiledCircuit = JSON.parse(
  readFileSync(new URL("../circuits/target/wakestake.json", import.meta.url), "utf8"),
) as CompiledCircuit;

const STAKE = 100n * 10n ** 18n;
const FEE_PERCENTAGE = 10n;
const AFTER_FEE = STAKE - (STAKE * FEE_PERCENTAGE) / 100n;
const POOL_LIQUIDITY = 10_000n * 10n ** 18n;

describe("DonationRouter (Sepolia fork)", async function () {
  const { viem, ignition, networkHelpers } = await network.create({
    override: { forking: { url: FORK_URL, blockNumber: FORK_BLOCK } },
  });
  const publicClient = await viem.getPublicClient();
  const [deployer, sleeper, groupMember, charity] = await viem.getWalletClients();

  async function deployFixture() {
    const { wakeStake } = await ignition.deploy(WakeStakeModule, {
      parameters: { WakeStakeModule: { feePercentage: FEE_PERCENTAGE } },
    });
    const stakeToken = await viem.deployContract("MockERC20", ["WakeStake Test USD", "wUSD"]);
    const charityToken = await viem.deployContract("MockERC20", ["Charity USD", "cUSD"]);
    const router = await viem.deployContract("DonationRouter", [
      UNISWAP_SEPOLIA.swapRouter02,
      charity.account.address,
      charityToken.address,
    ]);

    for (const token of [stakeToken, charityToken]) {
      await token.write.mint([deployer.account.address, POOL_LIQUIDITY]);
      await token.write.mint([sleeper.account.address, STAKE]);
      await token.write.approve([wakeStake.address, STAKE], { account: sleeper.account });
    }
    await createPoolWithLiquidity(publicClient, deployer, stakeToken.address, charityToken.address, POOL_LIQUIDITY);
    return { wakeStake, stakeToken, charityToken, router };
  }

  /** Stakes `token` with the router as donation address, oversleeps, and lets a group member slash it into the router. */
  async function slashIntoRouter(token: Address) {
    const { wakeStake, router } = await networkHelpers.loadFixture(deployFixture);
    const stakeDetails = {
      token: addressToField(token),
      amount: STAKE,
      donationAddress: addressToField(router.address),
    };
    const staked = createNote(stakeDetails, BigInt(await networkHelpers.time.latest()) + DAY);
    await wakeStake.write.stake([token, STAKE, noteAllSecretsHash(staked.note)], { account: sleeper.account });

    await networkHelpers.time.increase(DAY + HOUR);
    const transactionTimestamp = BigInt(await networkHelpers.time.latest()) + 1n;
    const { pastTimestamp, futureTimestamp } = createTimestampWindow(transactionTimestamp);
    const { proof, root, nullifier, lose } = await generateProof(compiledCircuit, {
      merkleTree: await fetchMerkleTree(publicClient, wakeStake.address),
      note: staked.note,
      secret: 0n, // the group doesn't know it
      pastTimestamp,
      futureTimestamp,
      withdrawal: { recipient: stakeDetails.donationAddress, token: stakeDetails.token, amount: STAKE },
    });
    await networkHelpers.time.setNextBlockTimestamp(transactionTimestamp);
    await wakeStake.write.withdraw(
      [router.address, token, STAKE, root, nullifier, pastTimestamp, futureTimestamp, lose, proof],
      { account: groupMember.account },
    );
  }

  it("swaps a slashed stake on Uniswap into the charity's token", async function () {
    const { stakeToken, charityToken, router } = await networkHelpers.loadFixture(deployFixture);
    await slashIntoRouter(stakeToken.address);
    assert.equal(await stakeToken.read.balanceOf([router.address]), AFTER_FEE);

    const quote = await quoteExactInputSingle(publicClient, UNISWAP_SEPOLIA.quoterV2, {
      tokenIn: stakeToken.address,
      tokenOut: charityToken.address,
      amountIn: AFTER_FEE,
      fee: POOL_FEE,
    });
    assert.ok(quote > 0n && quote < AFTER_FEE, "a 1:1 pool minus the 0.3% fee and price impact");

    await viem.assertions.emitWithArgs(
      router.write.donate([stakeToken.address, POOL_FEE, (quote * 99n) / 100n], { account: groupMember.account }),
      router,
      "Donated",
      [(tokenIn: Address) => tokenIn.toLowerCase() === stakeToken.address.toLowerCase(), AFTER_FEE, quote],
    );
    assert.equal(await charityToken.read.balanceOf([charity.account.address]), quote);
    assert.equal(await stakeToken.read.balanceOf([router.address]), 0n);
  });

  it("forwards the charity's own token without swapping", async function () {
    const { charityToken, router } = await networkHelpers.loadFixture(deployFixture);
    await slashIntoRouter(charityToken.address);

    await router.write.donate([charityToken.address, POOL_FEE, AFTER_FEE]);
    assert.equal(await charityToken.read.balanceOf([charity.account.address]), AFTER_FEE);
  });

  it("a failed swap loses nothing: the tokens wait in the router for a retry", async function () {
    const { stakeToken, charityToken, router } = await networkHelpers.loadFixture(deployFixture);
    await slashIntoRouter(stakeToken.address);

    // demanding more than the pool can give reverts in Uniswap's router
    await viem.assertions.revertWith(
      router.write.donate([stakeToken.address, POOL_FEE, AFTER_FEE * 2n]),
      "Too little received",
    );
    assert.equal(await stakeToken.read.balanceOf([router.address]), AFTER_FEE);

    await router.write.donate([stakeToken.address, POOL_FEE, 1n]);
    assert.ok((await charityToken.read.balanceOf([charity.account.address])) > 0n);
  });

  it("refuses to donate an empty balance", async function () {
    const { stakeToken, router } = await networkHelpers.loadFixture(deployFixture);
    await viem.assertions.revertWith(router.write.donate([stakeToken.address, POOL_FEE, 0n]), "nothing to donate");
  });
});
