import { getAddress, type Address, type Chain } from 'viem';
import { hardhat, sepolia } from 'viem/chains';
import sepoliaDeployment from '../../../../ignition/deployments/chain-11155111/deployed_addresses.json';

/**
 * Chain mode is on when VITE_CHAIN is set (see app/.env.example). Without it the app
 * runs on mock services, which is what the unit and e2e tests use.
 */
export interface ChainConfig {
  chain: Chain;
  rpcUrl: string;
  wakeStake: Address;
  /** ERC20 that gets staked. 1 token = $1 in the UI. */
  token: Address;
  /** Where a late stake goes. Fixed per note at stake time: the contract can't change it later. */
  donation: Address;
  /** MockERC20 only: mint yourself the difference when your balance is too low to stake. */
  mintTestTokens: boolean;
}

const CHAINS: Record<string, { chain: Chain; wakeStake?: string }> = {
  sepolia: { chain: sepolia, wakeStake: sepoliaDeployment['WakeStakeModule#WakeStake'] },
  localhost: { chain: hardhat },
};

type Env = Record<string, string | undefined>;

export function readChainConfig(env: Env = import.meta.env as Env): ChainConfig | null {
  const name = env.VITE_CHAIN;
  if (!name) return null;
  const known = CHAINS[name];
  if (!known) throw new Error(`VITE_CHAIN=${name} is not supported (use sepolia or localhost)`);
  const required = (key: string, fallback?: string) => {
    const value = env[key] || fallback;
    if (!value) throw new Error(`${key} is required when VITE_CHAIN is set (see app/.env.example)`);
    return value;
  };
  return {
    chain: known.chain,
    rpcUrl: required('VITE_RPC_URL', known.chain.rpcUrls.default.http[0]),
    wakeStake: getAddress(required('VITE_WAKESTAKE_ADDRESS', known.wakeStake)),
    token: getAddress(required('VITE_TOKEN_ADDRESS')),
    donation: getAddress(required('VITE_DONATION_ADDRESS')),
    mintTestTokens: env.VITE_MINT_TEST_TOKENS === '1',
  };
}
