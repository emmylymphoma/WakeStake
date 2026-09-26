// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IDonationAddressProvider} from "./interfaces/IDonationAddressProvider.sol";

/// @notice A friend group's donation address. Stakers commit to this contract, and when they
/// oversleep WakeStake pays `donationAddress` directly. Deployed as clones by DonationGroupFactory.
contract DonationGroup is IDonationAddressProvider, Initializable {
    address public donationAddress;

    /// @dev the implementation itself can never be initialized, only its clones
    constructor() {
        _disableInitializers();
    }

    /// @dev clones have no constructor, so the factory calls this in the same transaction as the clone
    function initialize(address _donationAddress) external initializer {
        // 0 would make WakeStake send lost stakes to this contract, which has no way to move them
        require(_donationAddress != address(0), "donation address cannot be zero");
        donationAddress = _donationAddress;
    }
}
