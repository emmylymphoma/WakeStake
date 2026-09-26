// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IDonationAddressProvider} from "../interfaces/IDonationAddressProvider.sol";

/// @notice Test-only stand-in for a friend group contract.
contract MockDonationAddressProvider is IDonationAddressProvider {
    address public donationAddress;

    constructor(address _donationAddress) {
        donationAddress = _donationAddress;
    }

    function setDonationAddress(address _donationAddress) external {
        donationAddress = _donationAddress;
    }
}
