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