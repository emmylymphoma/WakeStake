# Uniswap developer feedback

What we built: when a WakeStake user oversleeps, their staked token goes to a `DonationRouter`
([contracts/DonationRouter.sol](contracts/DonationRouter.sol)), which swaps it through Uniswap v3's
SwapRouter02 into the token the charity wants and forwards it. The app quotes the swap with QuoterV2
first and sets a 1% slippage limit. Pool setup and quoting live in [src/uniswap.ts](src/uniswap.ts).

## What worked well

- The v3 contracts on Sepolia were easy to confirm: SwapRouter02, QuoterV2 and the
  NonfungiblePositionManager all report the same `factory()`, so we could check we had a matching set.
- `exactInputSingle` with `recipient` set to the charity means the swap output never touches our contract.
- `createAndInitializePoolIfNecessary` made creating a demo pool for our test tokens a single call.

## Friction

- **Two `ExactInputSingleParams` structs.** The original SwapRouter has a `deadline` field, SwapRouter02
  (IV3SwapRouter) doesn't. Many examples use the old struct, and encoding it against SwapRouter02
  silently produces a different function selector. A clear "which router is deployed where" note
  next to each struct would help.
- **QuoterV2 isn't `view`.** It returns results by reverting internally, so a plain `readContract`
  fails and you have to simulate the call. Obvious once you know, but it costs every new integrator time.
- **Forking Sepolia with free RPCs.** Public Sepolia endpoints only keep recent state, and Hardhat's
  default fork block is further back than they keep, so fork tests fail with "historical state is not
  available". We now fork a few blocks behind the tip. Documenting a known-good testnet fork setup
  (or an official archive RPC for testnets) would save time.
- **Full-range ticks.** Getting the min/max tick right for a fee tier (±887220 for the 0.3% tier's
  spacing of 60) is a footgun: an off-by-spacing value just reverts. A helper or table in the docs would help.
- **Price protection for permissionless swaps.** Our `donate()` is callable by anyone, so the caller
  picks `amountOutMinimum`. A documented, simple pattern for on-chain minimums from a pool's TWAP
  (including how to raise observation cardinality on a fresh pool) would make this safe by default.
