// Points wakestake.eth at the registry the WakeStake Ignition module deployed, so <group>.wakestake.eth resolves.
// Run after `pnpm ens:register` and the Ignition deployment, with the wallet that owns wakestake.eth.
// Safe to rerun: skips whatever is linked already.
//
//   pnpm ens:link
//   DEPLOYMENT_ID=my-deployment pnpm ens:link     (defaults to Ignition's chain-11155111)
import { readFileSync } from "node:fs";

import { network } from "hardhat";
import { getAddress, hexToBigInt, labelhash, type Address } from "viem";

import { ENS_ROOT_LABEL, ENS_SEPOLIA } from "../src/constants.js";

const deploymentId = process.env.DEPLOYMENT_ID ?? "chain-11155111";
const deployedAddresses = JSON.parse(
  readFileSync(new URL(`../ignition/deployments/${deploymentId}/deployed_addresses.json`, import.meta.url), "utf8"),
) as Record<string, Address>;
const wakeStakeRegistryAddress = deployedAddresses["WakeStakeModule#WakeStakeRegistry"];
if (!wakeStakeRegistryAddress) throw new Error(`no WakeStakeRegistry in Ignition deployment ${deploymentId}`);

const { viem } = await network.create();
const publicClient = await viem.getPublicClient();
const [wallet] = await viem.getWalletClients();
const me = wallet.account.address;
// ENS's .eth registry is a PermissionedRegistry too, so the UserRegistry ABI covers it
const ethRegistry = await viem.getContractAt("EnsV2UserRegistry", ENS_SEPOLIA.ethRegistry);
const wakeStakeRegistry = await viem.getContractAt("EnsV2UserRegistry", wakeStakeRegistryAddress);
const name = `${ENS_ROOT_LABEL}.eth`;

const owner = await ethRegistry.read.findOwner([ENS_ROOT_LABEL]);
if (getAddress(owner) !== getAddress(me)) {
  throw new Error(`${name} is owned by ${owner}, run this with that wallet (this one is ${me})`);
}

const send = async (hash: `0x${string}`, what: string) => {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${what} failed: ${hash}`);
  console.log(`  ${what}: ${hash}`);
};

// wakestake.eth -> our registry, so ENS walks into it for <group>.wakestake.eth
const currentSubregistry = await ethRegistry.read.getSubregistry([ENS_ROOT_LABEL]);
if (getAddress(currentSubregistry) === getAddress(wakeStakeRegistryAddress)) {
  console.log(`${name} already points to ${wakeStakeRegistryAddress}`);
} else {
  await send(
    await ethRegistry.write.setSubregistry([hexToBigInt(labelhash(ENS_ROOT_LABEL)), wakeStakeRegistryAddress]),
    `point ${name} to ${wakeStakeRegistryAddress}`,
  );
}

// our registry -> (.eth registry, "wakestake"), so ENS knows its canonical name
const [parent, childLabel] = await wakeStakeRegistry.read.getParent();
if (getAddress(parent) === getAddress(ENS_SEPOLIA.ethRegistry) && childLabel === ENS_ROOT_LABEL) {
  console.log(`registry already knows it is ${name}`);
} else {
  await send(
    await wakeStakeRegistry.write.setParent([ENS_SEPOLIA.ethRegistry, ENS_ROOT_LABEL]),
    `set the registry's parent to ${name}`,
  );
}
