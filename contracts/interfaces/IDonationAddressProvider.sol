// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @notice Implemented by contracts used as a stake's donation address, e.g. a friend group.
/// When a stake is lost, WakeStake pays `donationAddress()` directly instead of the contract itself.
/// Returning address(0) means "keep it": the tokens go to the implementing contract.
interface IDonationAddressProvider {
    function donationAddress() external view returns (address);
}
