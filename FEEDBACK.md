# ENS feedback

Mainly just adding ABI and contracts to npm instead of only gitmodules 

## No npm package for ABIs

There is no documented npm package with the ENSv2 ABIs. Which caused claude to copy and paste it. Gitmodules can also be used but not my preference. npm package would be my preference.

### Blocker claude found:
- `@ensdomains/ensjs@5.0.0-sepolia-fix.1` does contain ENSv2 ABIs. But it's only reachable through an npm dist-tag,
  isn't mentioned in the docs, and has none of the current Sepolia addresses (it predates the 2026-09-15 deployment).
- The only up-to-date ABIs are the JSON files in `contracts/deployments/sepolia/` of the contracts-v2 repo.


## No npm package for `contracts/`

Again not a real blocker but personal prefference for npm.
Also needed to create: contracts/ens/EnsV2.sol which a ugly hack to get hardhat to compile the contracts so they can be used in tests.  


### Some blockers claude found:
- contracts-v2's `package.json` is `"private": true` with no version or exports, so it can't be installed from npm.
- Installing it from GitHub with pnpm doesn't work, because its imports resolve through its own git submodules
  (OpenZeppelin, openzeppelin-contracts-upgradeable, verifiable-factory, ens-contracts), which package managers don't fetch.
- So we added it as a submodule. To deploy `UserRegistry`, `LabelStore` and `VerifiableFactory` locally in tests we
  needed four of its nested submodules, plus two nested OpenZeppelin checkouts inside verifiable-factory and
  openzeppelin-contracts-upgradeable. Hardhat 3 applies each `remappings.txt` only to its own folder, so those resolve
  OpenZeppelin from their own `lib/`. That's about 110 MB for a handful of contracts.
- `LabelStore` pulls in ens-contracts (v1) just for `NameCoder`, and the npm `@ensdomains/ens-contracts` package can't
  replace it, because contracts-v2 remaps `@ens/contracts` to its submodule.


## admin role usecase (positive)
Bit late in the night but i now realize that this is a great usecase for ens V2. Everyone rn uses openzeppelin for admin roles and such which is confusing af to look at. You have to have some hash of a role, then look up a mapping just to see which eoa might rug all your funds of a contract you wanted to use. 
But if you let ens do it. You can make it easily transferable roles and you can just look up subdomains on the ens ui and have pretty good idea what is going on!
You could built that with V1 but then you have sort of standard ish wrapper tokens and non standard registrars or other hacks. Practically achieves the same but not great ux and non standard
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
