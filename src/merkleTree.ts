import { LeanIMT } from "@zk-kit/lean-imt";
import { parseAbi, type Address, type PublicClient } from "viem";

import { hashMerkleNode } from "./hashing.js";

const wakeStakeAbi = parseAbi([
  "function getLeaves(uint256 _start, uint256 _stop) view returns (uint256[])",
]);

/** Leaves per `getLeaves` call. Small enough for an Infura basic plan's eth_call limits. */
export const LEAVES_PER_CHUNK = 1000n;

/**
 * Rebuilds the contract's LeanIMT off-chain by reading `leaves` from storage in chunks.
 * Every chunk is read at the same block, so the tree is a consistent snapshot.
 * LeanIMT never stores a zero leaf, so the first zero marks the end of the tree.
 */
export async function fetchMerkleTree(
  publicClient: PublicClient,
  wakeStakeAddress: Address,
  leavesPerChunk = LEAVES_PER_CHUNK,
): Promise<LeanIMT<bigint>> {
  const blockNumber = await publicClient.getBlockNumber();
  const allLeaves: bigint[] = [];

  for (let chunkStart = 0n; ; chunkStart += leavesPerChunk) {
    const chunk = await publicClient.readContract({
      address: wakeStakeAddress,
      abi: wakeStakeAbi,
      functionName: "getLeaves",
      args: [chunkStart, chunkStart + leavesPerChunk],
      blockNumber,
    });
    const endOfTree = chunk.indexOf(0n);
    allLeaves.push(...(endOfTree === -1 ? chunk : chunk.slice(0, endOfTree)));
    if (endOfTree !== -1) break;
  }

  return new LeanIMT<bigint>(hashMerkleNode, allLeaves);
}
