// Registers `wakestake.eth` (or ENS_LABEL.eth) on the ENSv2 beta on Sepolia.
// Safe to rerun: exits early if the deployer already owns the name, so after an
// ENS testnet reset you just run it again.
//
//   pnpm ens:register                      (defaults from src/constants.ts)
//   ENS_LABEL=foo ENS_YEARS=2 pnpm ens:register
//
// Payment is the free-mint MockUSDC that the ENSv2 beta price oracle accepts.
import { network } from "hardhat";
import { erc20Abi, keccak256, toHex, zeroAddress, zeroHash } from "viem";
import { ensEthRegistrarAbi, ensRegistryAbi, mockErc20MintAbi } from "../src/abis.js";
import { ENS_ROOT_LABEL, ENS_ROOT_REGISTRATION_YEARS, ENS_SEPOLIA, YEAR } from "../src/constants.js";

const LABEL = process.env.ENS_LABEL ?? ENS_ROOT_LABEL;
const DURATION = (process.env.ENS_YEARS ? BigInt(process.env.ENS_YEARS) : ENS_ROOT_REGISTRATION_YEARS) * YEAR;
const { ethRegistrar, ethRegistry, mockUsdc } = ENS_SEPOLIA;

const { viem } = await network.create();
const publicClient = await viem.getPublicClient();
const [wallet] = await viem.getWalletClients();
const me = wallet.account.address;
const name = `${LABEL}.eth`;

const send = async (hash: `0x${string}`, what: string) => {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${what} failed: ${hash}`);
  console.log(`  ${what}: ${hash}`);
  return receipt;
};

const printOwnership = async () => {
  const [owner, expiry] = await Promise.all([
    publicClient.readContract({ address: ethRegistry, abi: ensRegistryAbi, functionName: "findOwner", args: [LABEL] }),
    publicClient.readContract({ address: ethRegistry, abi: ensRegistryAbi, functionName: "findExpiry", args: [LABEL] }),
  ]);
  console.log(`${name} owner:  ${owner}`);
  console.log(`${name} expiry: ${new Date(Number(expiry) * 1000).toISOString()}`);
  return owner;
};

const available = await publicClient.readContract({
  address: ethRegistrar, abi: ensEthRegistrarAbi, functionName: "isAvailable", args: [LABEL],
});
if (!available) {
  const owner = await printOwnership();
  if (owner.toLowerCase() !== me.toLowerCase()) {
    throw new Error(`${name} is taken by ${owner}, not by ${me}`);
  }
  console.log("Already registered to this wallet, nothing to do.");
  process.exit(0);
}

console.log(`Registering ${name} for ${me}`);

// 1. Pay: mint MockUSDC if needed and approve the registrar.
const [base, premium] = await publicClient.readContract({
  address: ethRegistrar, abi: ensEthRegistrarAbi, functionName: "getRegisterPrice", args: [LABEL, DURATION, mockUsdc],
});
const price = base + premium;
console.log(`  price: ${price} MockUSDC units (6 decimals)`);

const balance = await publicClient.readContract({ address: mockUsdc, abi: erc20Abi, functionName: "balanceOf", args: [me] });
if (balance < price) {
  await send(await wallet.writeContract({ address: mockUsdc, abi: mockErc20MintAbi, functionName: "mint", args: [me, price - balance] }), "mint MockUSDC");
}
const allowance = await publicClient.readContract({ address: mockUsdc, abi: erc20Abi, functionName: "allowance", args: [me, ethRegistrar] });
if (allowance < price) {
  await send(await wallet.writeContract({ address: mockUsdc, abi: erc20Abi, functionName: "approve", args: [ethRegistrar, price] }), "approve");
}

// 2. Commit. No subregistry or resolver yet: the owner holds ROLE_SET_SUBREGISTRY
// and ROLE_SET_RESOLVER and sets them later, once the group factory exists.
const secret = keccak256(toHex(`${me}-${LABEL}-${Date.now()}-${Math.random()}`));
const commitArgs = [LABEL, me, secret, zeroAddress, zeroAddress, DURATION] as const;
const commitment = await publicClient.readContract({
  address: ethRegistrar, abi: ensEthRegistrarAbi, functionName: "makeCommitment", args: [...commitArgs, zeroHash],
});
const commitReceipt = await send(await wallet.writeContract({ address: ethRegistrar, abi: ensEthRegistrarAbi, functionName: "commit", args: [commitment] }), "commit");

// 3. Wait until a block is past MIN_COMMITMENT_AGE (60s on the beta).
const minAge = await publicClient.readContract({ address: ethRegistrar, abi: ensEthRegistrarAbi, functionName: "MIN_COMMITMENT_AGE" });
const commitTs = (await publicClient.getBlock({ blockNumber: commitReceipt.blockNumber })).timestamp;
console.log(`  waiting ${minAge}s for the commitment to mature...`);
while ((await publicClient.getBlock()).timestamp <= commitTs + minAge) {
  await new Promise((r) => setTimeout(r, 6_000));
}

// 4. Register.
await send(await wallet.writeContract({
  address: ethRegistrar, abi: ensEthRegistrarAbi, functionName: "register",
  args: [...commitArgs, mockUsdc, zeroHash],
}), "register");

await printOwnership();
