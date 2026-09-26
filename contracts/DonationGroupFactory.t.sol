// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {DonationGroup} from "./DonationGroup.sol";
import {DonationGroupFactory} from "./DonationGroupFactory.sol";

contract DonationGroupFactoryTest is Test {
    event DonationGroupCreated(address indexed donationGroup, address indexed donationAddress, address indexed creator);

    DonationGroupFactory factory;
    address charity = makeAddr("charity");
    address otherCharity = makeAddr("otherCharity");
    address creator = makeAddr("creator");

    function setUp() public {
        factory = new DonationGroupFactory();
    }

    function test_CreateSetsTheCallersDonationAddress() public {
        vm.prank(creator);
        address group = factory.createDonationGroup(charity);

        assertEq(DonationGroup(group).donationAddress(), charity);
    }

    function test_CreateEmitsDonationGroupCreated() public {
        // the clone address isn't known before the call, so only check the indexed donation address and creator
        vm.expectEmit(false, true, true, true, address(factory));
        emit DonationGroupCreated(address(0), charity, creator);
        vm.prank(creator);
        factory.createDonationGroup(charity);
    }

    function test_EachGroupIsASeparateCloneWithItsOwnAddress() public {
        address group = factory.createDonationGroup(charity);
        address otherGroup = factory.createDonationGroup(otherCharity);

        assertTrue(group != otherGroup);
        assertEq(DonationGroup(group).donationAddress(), charity);
        assertEq(DonationGroup(otherGroup).donationAddress(), otherCharity);
    }

    function test_CloneCannotBeInitializedTwice() public {
        address group = factory.createDonationGroup(charity);

        vm.expectRevert(Initializable.InvalidInitialization.selector);
        DonationGroup(group).initialize(otherCharity);
    }

    function test_ImplementationCannotBeInitialized() public {
        // read first: expectRevert applies to the next call, which would otherwise be implementation()
        DonationGroup implementation = DonationGroup(factory.implementation());
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        implementation.initialize(charity);
    }

    function test_RejectsZeroDonationAddress() public {
        vm.expectRevert("donation address cannot be zero");
        factory.createDonationGroup(address(0));
    }
}
