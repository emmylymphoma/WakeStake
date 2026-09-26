// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {DonationGroup} from "./DonationGroup.sol";

/// @notice Deploys cheap DonationGroup clones (EIP-1167 minimal proxies).
contract DonationGroupFactory {
    /// @notice the DonationGroup every clone delegates to
    address public immutable implementation;

    event DonationGroupCreated(address indexed donationGroup, address indexed donationAddress, address indexed creator);

    constructor() {
        implementation = address(new DonationGroup());
    }

    /// @notice use the returned address as the donation address when staking
    /// @param _donationAddress where lost stakes committed to the new group get paid
    function createDonationGroup(address _donationAddress) external returns (address donationGroup) {
        donationGroup = Clones.clone(implementation);
        DonationGroup(donationGroup).initialize(_donationAddress);
        emit DonationGroupCreated(donationGroup, _donationAddress, msg.sender);
    }
}
