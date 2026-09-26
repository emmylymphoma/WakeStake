// Deploys WakeStake + a mintable test token to a running `pnpm hardhat node`,
// then writes app/.env.local so `cd app && npm run dev` talks to it.
import { writeFileSync } from "node:fs";
import { network } from "hardhat";
import { zeroAddress } from "viem";

import TestTokenModule from "../ignition/modules/TestToken.js";
import WakeStakeModule from "../ignition/modules/WakeStake.js";

const { viem, ignition } = await network.create({ network: "localhost" });
const [deployer, charity] = await viem.getWalletClients();

// a local node has no ENSv2, so deploy ENS's own contracts first (same as test/helpers/wakeStakeTestContext.ts)
const labelStore = await viem.deployContract("EnsV2LabelStore", [zeroAddress]);
const userRegistryImplementation = await viem.deployContract("EnsV2UserRegistry", [
  labelStore.address,
  deployer.account.address,
]);
const verifiableFactory = await viem.deployContract("EnsV2VerifiableFactory");

const { wakeStake } = await ignition.deploy(WakeStakeModule, {
  parameters: {
    WakeStakeModule: {
      feePercentage: 10n,
      ensVerifiableFactory: verifiableFactory.address,
      ensUserRegistryImplementation: userRegistryImplementation.address,
    },
  },
});
const { token } = await ignition.deploy(TestTokenModule);

const env = {
  VITE_CHAIN: "localhost",
  VITE_WAKESTAKE_ADDRESS: wakeStake.address,
  VITE_TOKEN_ADDRESS: token.address,
  // Hardhat account #1 plays the charity, so you can watch its balance.
  VITE_DONATION_ADDRESS: charity.account.address,
  VITE_MINT_TEST_TOKENS: "1",
};
writeFileSync(
  new URL("../app/.env.local", import.meta.url),
  Object.entries(env).map(([key, value]) => `${key}=${value}`).join("\n") + "\n",
);

console.log(`WakeStake ${wakeStake.address}, test token ${token.address}, deployer ${deployer.account.address}`);
console.log("Wrote app/.env.local");
