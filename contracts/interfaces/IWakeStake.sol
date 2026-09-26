// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @notice The WakeStake state a group needs to check a StakeOwnershipVerifier proof.
interface IWakeStake {
    function rootHistory(uint256 root) external view returns (bool);
    function nullifiers(uint256 nullifier) external view returns (bool);
}
