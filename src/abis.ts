import { parseAbi } from "viem";

// ENSv2 has no npm package with ABIs, so these are hand-copied from
// github.com/ensdomains/contracts-v2 at tag sepolia-deployment-2026-09-15,
// which is what the Sepolia beta runs (main has different signatures).

export const ensEthRegistrarAbi = parseAbi([
  "function isAvailable(string label) view returns (bool)",
  "function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)",
  "function MIN_COMMITMENT_AGE() view returns (uint64)",
  "function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)",
  "function commit(bytes32 commitment)",
  "function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256 tokenId)",
]);

export const ensRegistryAbi = parseAbi([
  "function findOwner(string label) view returns (address)",
  "function findExpiry(string label) view returns (uint64)",
]);

/** Free public mint on the ENS beta's MockUSDC / MockDAI. Use viem's erc20Abi for the rest. */
export const mockErc20MintAbi = parseAbi(["function mint(address to, uint256 amount)"]);
