// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IDonationAddressProvider} from "./interfaces/IDonationAddressProvider.sol";
import {IStakeOwnershipVerifier} from "./interfaces/IStakeOwnershipVerifier.sol";
import {IWakeStake} from "./interfaces/IWakeStake.sol";

/// @notice A friend group. Stakers commit to this contract as their donation address, and when they
/// oversleep WakeStake pays `donationAddress` directly. Members prove with a stake_ownership proof that
/// they stake at least `minStakeAmount` of `stakeToken` to this group, without revealing which stake.
/// Deployed as clones by DonationGroupFactory.
contract DonationGroup is IDonationAddressProvider, Initializable {
    /// @dev immutables live in the implementation's code, so every clone shares them
    IWakeStake public immutable wakeStake;
    IStakeOwnershipVerifier public immutable stakeOwnershipVerifier;

    address public donationAddress;
    /// @notice whoever created the group, the only account that can add members
    address public admin;
    address public stakeToken;
    uint256 public minStakeAmount;
    mapping(address member => bool isAdded) public isMember;

    event MemberAdded(address indexed member);
    event NewMember(address indexed member, string name);
    event Voted(address indexed voter, address indexed cause);

    /// @dev the implementation itself can never be initialized, only its clones
    constructor(IWakeStake _wakeStake, IStakeOwnershipVerifier _stakeOwnershipVerifier) {
        wakeStake = _wakeStake;
        stakeOwnershipVerifier = _stakeOwnershipVerifier;
        _disableInitializers();
    }

    /// @dev clones have no constructor, so the factory calls this in the same transaction as the clone
    function initialize(address _donationAddress, address _admin, address _stakeToken, uint256 _minStakeAmount)
        external
        initializer
    {
        // 0 would make WakeStake send lost stakes to this contract, which has no way to move them
        require(_donationAddress != address(0), "donation address cannot be zero");
        donationAddress = _donationAddress;
        admin = _admin;
        stakeToken = _stakeToken;
        minStakeAmount = _minStakeAmount;
    }

    function addMember(address _member) external {
        require(msg.sender == admin, "only the group admin can add members");
        isMember[_member] = true;
        emit MemberAdded(_member);
    }

    /// @notice mock for now: will register `<_name>.<group>.wakestake.eth` to the caller
    function registerName(string calldata _name, uint256 _root, uint256 _nullifier, bytes calldata _proof) external {
        _verifyStakeOwnership(_root, _nullifier, _proof);
        emit NewMember(msg.sender, _name);
    }

    /// @notice mock for now: will count votes for where lost stakes get donated
    function vote(address _cause, uint256 _root, uint256 _nullifier, bytes calldata _proof) external {
        _verifyStakeOwnership(_root, _nullifier, _proof);
        emit Voted(msg.sender, _cause);
    }

    /**
     * @notice lays out the public inputs in the order the circuit expects them, see `main` in
     * circuits/stake_ownership/src/main.nr. Public so the ui can debug against it.
     */
    function formatStakeOwnershipPublicInputs(uint256 _root, uint256 _nullifier, address _claimer)
        public
        view
        returns (bytes32[] memory publicInputs)
    {
        publicInputs = new bytes32[](6);
        publicInputs[0] = bytes32(_root);
        publicInputs[1] = bytes32(_nullifier);
        publicInputs[2] = bytes32(uint256(uint160(stakeToken)));
        publicInputs[3] = bytes32(minStakeAmount);
        // the stake must donate to this group
        publicInputs[4] = bytes32(uint256(uint160(address(this))));
        // the proof only works for the caller, so a copied proof is useless
        publicInputs[5] = bytes32(uint256(uint160(_claimer)));
    }

    /// @dev the caller owns an unspent stake of at least minStakeAmount of stakeToken that donates to this group
    function _verifyStakeOwnership(uint256 _root, uint256 _nullifier, bytes calldata _proof) internal view {
        require(isMember[msg.sender], "not added by the group admin");
        require(wakeStake.rootHistory(_root), "root provided has not existed in WakeStake");
        // wake() and withdraw() spend it, so prove with your current stake
        require(!wakeStake.nullifiers(_nullifier), "stake was already withdrawn or woken up");
        bytes32[] memory publicInputs = formatStakeOwnershipPublicInputs(_root, _nullifier, msg.sender);
        require(stakeOwnershipVerifier.verify(_proof, publicInputs), "invalid proof");
    }
}
