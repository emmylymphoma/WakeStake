// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "@ensdomains/contracts-v2/registry/libraries/RegistryRolesLib.sol";
import {IDonationAddressProvider} from "./interfaces/IDonationAddressProvider.sol";
import {IStakeOwnershipVerifier} from "./interfaces/IStakeOwnershipVerifier.sol";
import {IWakeStake} from "./interfaces/IWakeStake.sol";

/**
 * @notice A friend group, named `<label>.wakestake.eth`.
 *
 * Stakers commit to this contract as their donation address, so when they oversleep WakeStake pays the group's
 * `donationAddress`. The admin invites addresses. Each invitee who proves in zk that they stake at least
 * `minStakeAmount` of `stakeToken` to this group gets one ENS name, `<name>.<label>.wakestake.eth`.
 * Names are permanent and transferable, and each name is one vote on `donationAddress` and `minStakeAmount`.
 *
 * Deployed as clones by DonationGroupFactory, which also gives every group its own ENSv2 registry.
 * @dev ERC1155Holder because ENSv2 names are ERC1155 tokens and this contract owns `<label>.wakestake.eth`
 */
contract DonationGroup is IDonationAddressProvider, Initializable, ERC1155Holder {
    // ===== Constants =====

    /// @notice whoever owns `admin.<label>.wakestake.eth` is the group admin
    string public constant ADMIN_LABEL = "admin";
    /// @notice roles of every name this group registers: transferable, and free to set its own resolver
    uint256 public constant NAME_ROLES = RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN
        | RegistryRolesLib.ROLE_SET_RESOLVER | RegistryRolesLib.ROLE_SET_RESOLVER_ADMIN;
    uint64 internal constant NEVER_EXPIRES = type(uint64).max;

    /// @dev immutables live in the implementation's code, so every clone shares them
    IWakeStake public immutable wakeStake;
    IStakeOwnershipVerifier public immutable stakeOwnershipVerifier;

    // ===== State =====

    /// @notice the ENSv2 registry of `*.<label>.wakestake.eth`. This group is the only account that can register in it.
    IPermissionedRegistry public registry;
    /// @notice this group's name is `<label>.wakestake.eth`
    string public label;

    /// @notice where lost stakes get paid, changed by voteDonationAddress
    address public donationAddress;
    address public stakeToken;
    /// @notice the least members must stake to register a name and vote, changed by voteMinStakeAmount
    uint256 public minStakeAmount;

    /// @notice invited by the admin, which lets that address register one member name
    mapping(address account => bool) public isMember;
    mapping(address account => bool) public hasRegisteredName;
    /// @notice names registered through registerName, by labelhash. Votes belong to names, so they follow a transfer.
    mapping(uint256 nameId => bool) public isMemberName;
    /// @notice number of member names, a vote wins with more than half of them
    uint256 public memberCount;

    /// @dev one standing vote per member name, voting again moves it
    struct Poll {
        mapping(uint256 nameId => bool) hasVoted;
        mapping(uint256 nameId => uint256) choiceOf;
        mapping(uint256 choice => uint256) votes;
    }

    Poll internal donationAddressPoll;
    Poll internal minStakeAmountPoll;

    // ===== Events =====

    event MemberAdded(address indexed member);
    event NewMember(address indexed member, string name);
    event DonationAddressVoted(address indexed voter, string name, address indexed donationAddress, uint256 votes);
    event DonationAddressChanged(address indexed donationAddress);
    event MinStakeAmountVoted(address indexed voter, string name, uint256 minStakeAmount, uint256 votes);
    event MinStakeAmountChanged(uint256 minStakeAmount);

    // ===== Setup =====

    /// @dev the implementation itself can never be initialized, only its clones
    constructor(IWakeStake _wakeStake, IStakeOwnershipVerifier _stakeOwnershipVerifier) {
        wakeStake = _wakeStake;
        stakeOwnershipVerifier = _stakeOwnershipVerifier;
        _disableInitializers();
    }

    /**
     * @dev clones have no constructor, so the factory calls this in the same transaction as the clone
     * @param _admin receives `admin.<_label>.wakestake.eth`
     * @param _registry the group's ENSv2 registry, which must grant this group ROLE_REGISTRAR and ROLE_SET_PARENT
     * @param _parentRegistry the registry of wakestake.eth
     */
    function initialize(
        address _donationAddress,
        address _admin,
        address _stakeToken,
        uint256 _minStakeAmount,
        IPermissionedRegistry _registry,
        IRegistry _parentRegistry,
        string calldata _label
    ) external initializer {
        // 0 would make WakeStake send lost stakes to this contract, which has no way to move them
        require(_donationAddress != address(0), "donation address cannot be zero");
        donationAddress = _donationAddress;
        stakeToken = _stakeToken;
        minStakeAmount = _minStakeAmount;
        registry = _registry;
        label = _label;

        // so ENS can find this registry's canonical name, <_label>.wakestake.eth
        _registry.setParent(_parentRegistry, _label);
        _registerName(ADMIN_LABEL, _admin);
    }

    // ===== Members =====

    /// @notice the owner of `admin.<label>.wakestake.eth`, the only account that can add members
    function admin() public view returns (address) {
        return registry.findOwner(ADMIN_LABEL);
    }

    // TODO: add mechanism for member removal, maybe just dox who failed to wake in time and remove them upon donation.
    function addMember(address _member) external {
        require(msg.sender == admin(), "only the group admin can add members");
        require(!isMember[_member], "already a member");
        isMember[_member] = true;
        emit MemberAdded(_member);
    }

    /**
     * @notice registers `<_name>.<label>.wakestake.eth` to the caller, once per address. The caller must be added by
     * the admin and prove they stake the minimum. The name never expires and can be transferred, its vote goes with it.
     * @param _name must be ENS-normalized (e.g. lowercase), otherwise apps won't resolve it. Reverts if it's taken.
     */
    function registerName(string calldata _name, uint256 _root, uint256 _nullifier, bytes calldata _proof) external {
        require(isMember[msg.sender], "not added by the group admin");
        require(!hasRegisteredName[msg.sender], "already registered a name");
        _verifyStakeOwnership(_root, _nullifier, _proof);

        hasRegisteredName[msg.sender] = true;
        isMemberName[_nameId(_name)] = true;
        memberCount++;
        _registerName(_name, msg.sender);
        emit NewMember(msg.sender, _name);
    }

    // ===== Votes =====

    /// @notice vote with member name `_name` for where lost stakes get donated. Adopted once more than half agree.
    function voteDonationAddress(
        string calldata _name,
        address _donationAddress,
        uint256 _root,
        uint256 _nullifier,
        bytes calldata _proof
    ) external {
        require(_donationAddress != address(0), "donation address cannot be zero");
        uint256 nameId = _checkVoter(_name, _root, _nullifier, _proof);

        uint256 votes = _castVote(donationAddressPoll, nameId, uint160(_donationAddress));
        emit DonationAddressVoted(msg.sender, _name, _donationAddress, votes);
        if (_isMajority(votes) && _donationAddress != donationAddress) {
            donationAddress = _donationAddress;
            emit DonationAddressChanged(_donationAddress);
        }
    }

    /// @notice vote with member name `_name` for the least members must stake. Adopted once more than half agree.
    function voteMinStakeAmount(
        string calldata _name,
        uint256 _minStakeAmount,
        uint256 _root,
        uint256 _nullifier,
        bytes calldata _proof
    ) external {
        uint256 nameId = _checkVoter(_name, _root, _nullifier, _proof);

        uint256 votes = _castVote(minStakeAmountPoll, nameId, _minStakeAmount);
        emit MinStakeAmountVoted(msg.sender, _name, _minStakeAmount, votes);
        if (_isMajority(votes) && _minStakeAmount != minStakeAmount) {
            minStakeAmount = _minStakeAmount;
            emit MinStakeAmountChanged(_minStakeAmount);
        }
    }

    /// @notice the donation address member name `_nameId` currently votes for, 0 if it hasn't voted
    function donationAddressVoteOf(uint256 _nameId) external view returns (address) {
        return address(uint160(donationAddressPoll.choiceOf[_nameId]));
    }

    function donationAddressVotes(address _donationAddress) external view returns (uint256) {
        return donationAddressPoll.votes[uint160(_donationAddress)];
    }

    /// @notice the minimum member name `_nameId` currently votes for. 0 is a valid amount, hence `hasVoted`.
    function minStakeAmountVoteOf(uint256 _nameId) external view returns (bool hasVoted, uint256 amount) {
        return (minStakeAmountPoll.hasVoted[_nameId], minStakeAmountPoll.choiceOf[_nameId]);
    }

    function minStakeAmountVotes(uint256 _minStakeAmount) external view returns (uint256) {
        return minStakeAmountPoll.votes[_minStakeAmount];
    }

    // ===== Stake ownership proofs =====

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
        require(wakeStake.rootHistory(_root), "root provided has not existed in WakeStake");
        // wake() and withdraw() spend it, so prove with your current stake
        require(!wakeStake.nullifiers(_nullifier), "stake was already withdrawn or woken up");
        bytes32[] memory publicInputs = formatStakeOwnershipPublicInputs(_root, _nullifier, msg.sender);
        require(stakeOwnershipVerifier.verify(_proof, publicInputs), "invalid proof");
    }

    // ===== Internals =====

    /// @dev the caller owns member name `_name` and a qualifying stake. Returns the name's id.
    function _checkVoter(string calldata _name, uint256 _root, uint256 _nullifier, bytes calldata _proof)
        internal
        view
        returns (uint256 nameId)
    {
        nameId = _nameId(_name);
        require(isMemberName[nameId], "not a member name of this group");
        require(registry.findOwner(_name) == msg.sender, "you don't own this name");
        _verifyStakeOwnership(_root, _nullifier, _proof);
    }

    /// @dev moves member name `_nameId`'s vote in `_poll` to `_choice`. Returns how many votes `_choice` has now.
    function _castVote(Poll storage _poll, uint256 _nameId, uint256 _choice) internal returns (uint256) {
        if (_poll.hasVoted[_nameId]) _poll.votes[_poll.choiceOf[_nameId]]--;
        _poll.hasVoted[_nameId] = true;
        _poll.choiceOf[_nameId] = _choice;
        return ++_poll.votes[_choice];
    }

    /// @dev more than half of all member names, e.g. 3 of 5 or 3 of 4
    function _isMajority(uint256 _votes) internal view returns (bool) {
        return _votes * 2 > memberCount;
    }

    /// @dev registers `<_name>.<label>.wakestake.eth` to `_owner`. ENS reverts with LabelAlreadyRegistered if taken.
    function _registerName(string memory _name, address _owner) internal {
        registry.register(_name, _owner, IRegistry(address(0)), address(0), NAME_ROLES, NEVER_EXPIRES);
    }

    /// @dev the ENS labelhash, the id every registry uses for a label
    function _nameId(string calldata _name) internal pure returns (uint256) {
        return uint256(keccak256(bytes(_name)));
    }
}
