// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {DonationGroup} from "./DonationGroup.sol";
import {IStakeOwnershipVerifier} from "./interfaces/IStakeOwnershipVerifier.sol";
import {IWakeStake} from "./interfaces/IWakeStake.sol";

/// @notice Deploys cheap DonationGroup clones (EIP-1167 minimal proxies).
contract DonationGroupFactory {
    /// @notice the DonationGroup every clone delegates to
    address public immutable implementation;

    event DonationGroupCreated(address indexed donationGroup, address indexed donationAddress, address indexed admin);

    constructor(IWakeStake _wakeStake, IStakeOwnershipVerifier _stakeOwnershipVerifier) {
        implementation = address(new DonationGroup(_wakeStake, _stakeOwnershipVerifier));
    }

    /**
     * @notice creates a group with the caller as its admin. Use the returned address as the donation address when staking.
     * @param _donationAddress where lost stakes committed to the new group get paid
     * @param _stakeToken the token members must stake in
     * @param _minStakeAmount the least members must stake to register a name and vote
     */
    function createDonationGroup(address _donationAddress, address _stakeToken, uint256 _minStakeAmount)
        external
        returns (address donationGroup)
    {
        donationGroup = Clones.clone(implementation);
        DonationGroup(donationGroup).initialize(_donationAddress, msg.sender, _stakeToken, _minStakeAmount);
        emit DonationGroupCreated(donationGroup, _donationAddress, msg.sender);
    }
}
