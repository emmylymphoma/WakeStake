import { getAddress, type Address, type Chain } from 'viem';
import { hardhat, sepolia } from 'viem/chains';
import sepoliaDeployment from '../../../../ignition/deployments/chain-11155111/deployed_addresses.json';
import { POOL_FEE, UNISWAP_SEPOLIA } from '../../../../src/uniswap';

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
  /**
   * Set when `donation` is a DonationRouter: after a slash the app swaps the stake on Uniswap
   * into the charity's token. Unset: the charity simply receives the staked token.
   */
  donationRouter?: { quoter: Address; poolFee: number };
  /** MockERC20 only: mint yourself the difference when your balance is too low to stake. */
  mintTestTokens: boolean;
}

// Sepolia defaults come from the Ignition deployment, so a redeploy needs no env changes.
// Typed loosely: the JSON only has the keys of whatever was deployed last.
const deployed = sepoliaDeployment as Record<string, string | undefined>;
const CHAINS: Record<string, { chain: Chain; wakeStake?: string; token?: string; donationRouter?: string }> = {
  sepolia: {
    chain: sepolia,
    wakeStake: deployed['WakeStakeModule#WakeStake'],
    token: deployed['TestTokenModule#MockERC20'],
    donationRouter: deployed['DonationRouterModule#DonationRouter'],
  },
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
  // A DonationRouter is the donation address; it forwards to the charity after a Uniswap swap.
  // VITE_DONATION_ADDRESS (a plain charity or a DonationGroup) overrides the deployed router.
  const donationRouter = env.VITE_DONATION_ROUTER || (env.VITE_DONATION_ADDRESS ? undefined : known.donationRouter);
  return {
    chain: known.chain,
    rpcUrl: required('VITE_RPC_URL', known.chain.rpcUrls.default.http[0]),
    wakeStake: getAddress(required('VITE_WAKESTAKE_ADDRESS', known.wakeStake)),
    token: getAddress(required('VITE_TOKEN_ADDRESS', known.token)),
    donation: getAddress(donationRouter || required('VITE_DONATION_ADDRESS')),
    donationRouter: donationRouter
      ? {
          quoter: getAddress(env.VITE_UNISWAP_QUOTER || UNISWAP_SEPOLIA.quoterV2),
          poolFee: Number(env.VITE_UNISWAP_POOL_FEE || POOL_FEE),
        }
      : undefined,
    mintTestTokens: env.VITE_MINT_TEST_TOKENS === '1',
  };
}
