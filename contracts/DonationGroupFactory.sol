// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Grant, IEACGrantInitializable} from "@ensdomains/contracts-v2/access-control/interfaces/IEACGrantInitializable.sol";
import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "@ensdomains/contracts-v2/registry/libraries/RegistryRolesLib.sol";
import {IVerifiableFactory} from "@ensdomains/verifiable-factory/IVerifiableFactory.sol";
import {DonationGroup} from "./DonationGroup.sol";
import {IStakeOwnershipVerifier} from "./interfaces/IStakeOwnershipVerifier.sol";
import {IWakeStake} from "./interfaces/IWakeStake.sol";

/// @notice Deploys cheap DonationGroup clones (EIP-1167 minimal proxies) and names each one `<label>.wakestake.eth`.
/// This factory must hold ROLE_REGISTRAR on the wakestake.eth registry, so only groups it creates get a name.
contract DonationGroupFactory {
    /// @notice what a group can do in its own registry: register and renew names, and point to its parent.
    /// It holds no unregister, subregistry, resolver or upgrade role, so the registry stays emancipated:
    /// names in it can't be taken back and can be transferred safely.
    uint256 public constant GROUP_REGISTRY_ROLES =
        RegistryRolesLib.ROLE_REGISTRAR | RegistryRolesLib.ROLE_RENEW | RegistryRolesLib.ROLE_SET_PARENT;

    /// @notice the DonationGroup every clone delegates to
    address public immutable implementation;
    /// @notice the ENSv2 registry of wakestake.eth
    IPermissionedRegistry public immutable wakeStakeRegistry;
    /// @notice ENS's VerifiableFactory, deploys each group's registry proxy
    IVerifiableFactory public immutable verifiableFactory;
    /// @notice ENS's UserRegistry implementation, every group's registry proxies to it
    address public immutable userRegistryImplementation;

    event DonationGroupCreated(
        address indexed donationGroup,
        address indexed donationAddress,
        address indexed admin,
        string label,
        IPermissionedRegistry registry
    );

    constructor(
        IWakeStake _wakeStake,
        IStakeOwnershipVerifier _stakeOwnershipVerifier,
        IPermissionedRegistry _wakeStakeRegistry,
        IVerifiableFactory _verifiableFactory,
        address _userRegistryImplementation
    ) {
        implementation = address(new DonationGroup(_wakeStake, _stakeOwnershipVerifier));
        wakeStakeRegistry = _wakeStakeRegistry;
        verifiableFactory = _verifiableFactory;
        userRegistryImplementation = _userRegistryImplementation;
    }

    /**
     * @notice creates `<_label>.wakestake.eth`. The caller gets `admin.<_label>.wakestake.eth`, which makes them admin.
     * Use the returned address as the donation address when staking.
     * @param _label the group's name, reverts if it's taken
     * @param _donationAddress where lost stakes committed to the new group get paid
     * @param _stakeToken the token members must stake in
     * @param _minStakeAmount the least members must stake to register a name and vote
     */
    function createDonationGroup(
        string calldata _label,
        address _donationAddress,
        address _stakeToken,
        uint256 _minStakeAmount
    ) external returns (address donationGroup) {
        uint256 labelId = uint256(keccak256(bytes(_label)));
        // checked first for a clear error, the registry proxy's salt would collide otherwise
        require(
            wakeStakeRegistry.getStatus(labelId) == IPermissionedRegistry.Status.AVAILABLE,
            "group name is taken"
        );
        donationGroup = Clones.clone(implementation);
        IPermissionedRegistry groupRegistry = _deployGroupRegistry(donationGroup, labelId);
        DonationGroup(donationGroup).initialize(
            _donationAddress, msg.sender, _stakeToken, _minStakeAmount, groupRegistry, wakeStakeRegistry, _label
        );

        // <_label>.wakestake.eth, owned by the group and pointing to its registry. No roles, so it can't be
        // transferred and its subregistry can't be swapped.
        wakeStakeRegistry.register(
            _label, donationGroup, IRegistry(address(groupRegistry)), address(0), 0, type(uint64).max
        );
        emit DonationGroupCreated(donationGroup, _donationAddress, msg.sender, _label, groupRegistry);
    }

    /// @dev the registry of *.<label>.wakestake.eth, where only `_donationGroup` can register names
    function _deployGroupRegistry(address _donationGroup, uint256 _labelId) internal returns (IPermissionedRegistry) {
        Grant[] memory grants = new Grant[](1);
        grants[0] = Grant(_donationGroup, GROUP_REGISTRY_ROLES);
        return IPermissionedRegistry(
            verifiableFactory.deployProxy(
                userRegistryImplementation, _labelId, abi.encodeCall(IEACGrantInitializable.initialize, (grants))
            )
        );
    }
}
