// Uniswap v3 on Sepolia, used by DonationRouter to swap slashed stakes into the charity's token.
import { parseAbi, type Address, type PublicClient, type WalletClient } from "viem";

/** https://docs.uniswap.org/contracts/v3/reference/deployments (checked on-chain: all share the same factory) */
export const UNISWAP_SEPOLIA = {
  factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
  positionManager: "0x1238536071E1c677A632429e3655c799b22cDA52",
  swapRouter02: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
  quoterV2: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",
} as const satisfies Record<string, Address>;

/** 0.3% pool. Its tick spacing is 60, so these are the widest ticks it allows. */
export const POOL_FEE = 3000;
const MIN_TICK = -887220;
const MAX_TICK = 887220;

export const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const positionManagerAbi = parseAbi([
  "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) payable returns (address pool)",
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
]);

const erc20Abi = parseAbi(["function approve(address, uint256) returns (bool)"]);

/**
 * What `amountIn` of `tokenIn` swaps into right now. QuoterV2 isn't a view function
 * (it reverts internally to return the result), so it's simulated rather than read.
 */
export async function quoteExactInputSingle(
  publicClient: PublicClient,
  quoter: Address,
  params: { tokenIn: Address; tokenOut: Address; amountIn: bigint; fee: number },
): Promise<bigint> {
  const { result } = await publicClient.simulateContract({
    address: quoter,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [{ ...params, sqrtPriceLimitX96: 0n }],
  });
  return result[0];
}

/**
 * Creates a 1:1 full-range pool between two 18-decimal tokens and adds `amount` of each.
 * Demo liquidity for the test token pair; real charity tokens already have pools.
 */
export async function createPoolWithLiquidity(
  publicClient: PublicClient,
  walletClient: WalletClient,
  tokenA: Address,
  tokenB: Address,
  amount: bigint,
  positionManager: Address = UNISWAP_SEPOLIA.positionManager,
) {
  const account = walletClient.account!;
  const [token0, token1] = BigInt(tokenA) < BigInt(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
  // waitForTransactionReceipt resolves for reverted transactions too, so check the status
  const send = async (hash: Promise<`0x${string}`>) => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: await hash });
    if (receipt.status !== "success") throw new Error(`transaction reverted: ${receipt.transactionHash}`);
    return receipt;
  };

  for (const token of [token0, token1]) {
    await send(
      walletClient.writeContract({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [positionManager, amount],
        account,
        chain: walletClient.chain,
      }),
    );
  }
  // sqrt(1) * 2^96: a 1:1 starting price
  await send(
    walletClient.writeContract({
      address: positionManager,
      abi: positionManagerAbi,
      functionName: "createAndInitializePoolIfNecessary",
      args: [token0, token1, POOL_FEE, 2n ** 96n],
      account,
      chain: walletClient.chain,
    }),
  );
  await send(
    walletClient.writeContract({
      address: positionManager,
      abi: positionManagerAbi,
      functionName: "mint",
      args: [
        {
          token0,
          token1,
          fee: POOL_FEE,
          tickLower: MIN_TICK,
          tickUpper: MAX_TICK,
          amount0Desired: amount,
          amount1Desired: amount,
          amount0Min: 0n,
          amount1Min: 0n,
          recipient: account.address,
          deadline: 2n ** 48n,
        },
      ],
      account,
      chain: walletClient.chain,
    }),
  );
}
