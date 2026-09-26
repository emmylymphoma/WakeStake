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

    /// @notice members can change it with voteDonationAddress
    address public donationAddress;
    /// @notice whoever created the group, the only account that can add members
    address public admin;
    address public stakeToken;
    /// @notice members can change it with voteMinStakeAmount
    uint256 public minStakeAmount;
    mapping(address member => bool isAdded) public isMember;
    /// @notice everyone the admin added, a vote wins with more than half of them
    uint256 public memberCount;

    // Standing votes: each member has at most one vote per setting, voting again moves it.
    mapping(address member => address donationAddress) public donationAddressVoteOf;
    mapping(address donationAddress => uint256 votes) public donationAddressVotes;
    mapping(address member => bool hasVoted) public hasVotedMinStakeAmount;
    mapping(address member => uint256 minStakeAmount) public minStakeAmountVoteOf;
    mapping(uint256 minStakeAmount => uint256 votes) public minStakeAmountVotes;

    event MemberAdded(address indexed member);
    event NewMember(address indexed member, string name);
    event DonationAddressVoted(address indexed voter, address indexed donationAddress, uint256 votes);
    event DonationAddressChanged(address indexed donationAddress);
    event MinStakeAmountVoted(address indexed voter, uint256 minStakeAmount, uint256 votes);
    event MinStakeAmountChanged(uint256 minStakeAmount);

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

    // TODO: add mechanism for member removal, maybe just dox who failed to wake in time and remove them upon donation.
    function addMember(address _member) external {
        require(msg.sender == admin, "only the group admin can add members");
        // counted once, otherwise the admin could inflate memberCount and block every vote
        require(!isMember[_member], "already a member");
        isMember[_member] = true;
        memberCount++;
        emit MemberAdded(_member);
    }

    /// @notice mock for now: will register `<_name>.<group>.wakestake.eth` to the caller
    function registerName(string calldata _name, uint256 _root, uint256 _nullifier, bytes calldata _proof) external {
        _verifyStakeOwnership(_root, _nullifier, _proof);
        emit NewMember(msg.sender, _name);
    }

    /// @notice vote for where lost stakes get donated. Adopted instantly once more than half of all members agree.
    function voteDonationAddress(address _donationAddress, uint256 _root, uint256 _nullifier, bytes calldata _proof)
        external
    {
        require(_donationAddress != address(0), "donation address cannot be zero");
        _verifyStakeOwnership(_root, _nullifier, _proof);

        // simple tally, remove voteOf previous address, add it to new
        address previousVote = donationAddressVoteOf[msg.sender];
        if (previousVote != address(0)) donationAddressVotes[previousVote]--;
        donationAddressVoteOf[msg.sender] = _donationAddress;
        uint256 votes = ++donationAddressVotes[_donationAddress];
        emit DonationAddressVoted(msg.sender, _donationAddress, votes);

        if (_isMajority(votes) && _donationAddress != donationAddress) {
            donationAddress = _donationAddress;
            emit DonationAddressChanged(_donationAddress);
        }
    }

    /// @notice vote for the least members must stake. Adopted instantly once more than half of all members agree.
    function voteMinStakeAmount(uint256 _minStakeAmount, uint256 _root, uint256 _nullifier, bytes calldata _proof)
        external
    {
        _verifyStakeOwnership(_root, _nullifier, _proof);

        // 0 is a valid amount, so track "has voted" separately
        if (hasVotedMinStakeAmount[msg.sender]) minStakeAmountVotes[minStakeAmountVoteOf[msg.sender]]--;
        hasVotedMinStakeAmount[msg.sender] = true;
        minStakeAmountVoteOf[msg.sender] = _minStakeAmount;
        uint256 votes = ++minStakeAmountVotes[_minStakeAmount];
        emit MinStakeAmountVoted(msg.sender, _minStakeAmount, votes);

        if (_isMajority(votes) && _minStakeAmount != minStakeAmount) {
            minStakeAmount = _minStakeAmount;
            emit MinStakeAmountChanged(_minStakeAmount);
        }
    }

    /// @dev more than half of all members, e.g. 3 of 5 or 3 of 4
    function _isMajority(uint256 _votes) internal view returns (bool) {
        return _votes * 2 > memberCount;
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
