// Sets up Uniswap donations on Sepolia:
//   1. deploys a DonationRouter + demo charity token (cUSD) with Ignition
//   2. creates a wUSD/cUSD Uniswap v3 pool with demo liquidity (both are mintable test tokens)
//   3. points app/.env.local at the router
//
//   pnpm hardhat run scripts/setup-donation-router.ts --network sepolia
//
// CHARITY=0x… picks who receives the donations (default: the deployer).
// Needs TestTokenModule deployed first (the staked wUSD).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { network } from "hardhat";
import { getAddress, type Address } from "viem";

import DonationRouterModule from "../ignition/modules/DonationRouter.js";
import { createPoolWithLiquidity } from "../src/uniswap.js";

const LIQUIDITY = 1_000_000n * 10n ** 18n;

const { viem, ignition } = await network.create();
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();
const chainId = await publicClient.getChainId();

const deployed = JSON.parse(
  readFileSync(new URL(`../ignition/deployments/chain-${chainId}/deployed_addresses.json`, import.meta.url), "utf8"),
) as Record<string, Address>;
const stakeTokenAddress = deployed["TestTokenModule#MockERC20"];
if (!stakeTokenAddress) throw new Error("Deploy the staked test token first: ignition/modules/TestToken.ts");

const charity = getAddress(process.env.CHARITY ?? deployer.account.address);
const { donationRouter, charityToken } = await ignition.deploy(DonationRouterModule, {
  parameters: { DonationRouterModule: { charity } },
});
console.log(`DonationRouter ${donationRouter.address} → charity ${charity}, receives cUSD ${charityToken.address}`);

// Safe to rerun: only mints what's missing, and createPoolWithLiquidity adds to an existing pool.
const stakeToken = await viem.getContractAt("MockERC20", stakeTokenAddress);
for (const token of [stakeToken, charityToken]) {
  const balance = await token.read.balanceOf([deployer.account.address]);
  if (balance >= LIQUIDITY) continue;
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: await token.write.mint([deployer.account.address, LIQUIDITY - balance]),
  });
  if (receipt.status !== "success") throw new Error(`mint reverted: ${receipt.transactionHash}`);
}
await createPoolWithLiquidity(publicClient, deployer, stakeToken.address, charityToken.address, LIQUIDITY);
console.log(`Uniswap v3 pool wUSD/cUSD (0.3%) funded with ${LIQUIDITY / 10n ** 18n} of each`);

// Point the app at the router; the other settings stay as they are.
const envFile = new URL("../app/.env.local", import.meta.url);
const lines = (existsSync(envFile) ? readFileSync(envFile, "utf8") : "")
  .split("\n")
  .filter((line) => line && !line.startsWith("VITE_DONATION_ROUTER="));
writeFileSync(envFile, [...lines, `VITE_DONATION_ROUTER=${donationRouter.address}`].join("\n") + "\n");
console.log("Added VITE_DONATION_ROUTER to app/.env.local");
