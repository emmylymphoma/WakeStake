// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {LeanIMT, LeanIMTData} from "@zk-kit/lean-imt.sol/LeanIMT.sol";
import {PoseidonT4} from "poseidon-solidity/PoseidonT4.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IDonationAddressProvider} from "./interfaces/IDonationAddressProvider.sol";
import {IWakeStakeVerifier} from "./interfaces/IWakeStakeVerifier.sol";

/// @dev `owner()` (from Ownable) is the contract admin, not a staker
contract WakeStake is Ownable {
    using LeanIMT for LeanIMTData;
    using SafeERC20 for IERC20;

    IWakeStakeVerifier public immutable verifier;

    /// @notice percentage (0-100) taken from a stake when the owner woke up too late
    uint256 public immutable feePercentage;
    /// @notice receives the fee on every losing withdraw
    address public feePayoutAddress;

    LeanIMTData internal tree;

    // event indexing is a pain and not needed for hackathons!!!
    mapping(uint256 index => uint256 leaf) public leaves;
    mapping (uint256 root => bool itExists) public rootHistory;
    /// @notice public so groups can check a StakeOwnershipVerifier proof's stake wasn't withdrawn or woken yet
    mapping (uint256 nullifier => bool isSpent) public nullifiers;


    event LeafInserted(uint256 indexed leaf);
    event FeePayoutAddressChanged(address indexed feePayoutAddress);
    /// @param amount what donationAddress received, the stake minus the fee
    event YouLose(address indexed donationAddress, address indexed donationGroup, address indexed token, uint256 amount);

    /**
     * @param _verifier HonkVerifier from WakeStakeVerifier.sol
     * @param _owner the only account that can change the fee payout address
     * @param _feePayoutAddress receives the fee on losing withdraws, owner can change it later
     * @param _feePercentage percentage (0-100) taken from a stake when the owner woke up too late
     */
    constructor(address _verifier, address _owner, address _feePayoutAddress, uint256 _feePercentage) Ownable(_owner) {
      require(_feePayoutAddress != address(0), "fee payout address cannot be zero");
      require(_feePercentage <= 100, "fee percentage cannot be above 100");
      verifier = IWakeStakeVerifier(_verifier);
      feePayoutAddress = _feePayoutAddress;
      feePercentage = _feePercentage;
    }

    function setFeePayoutAddress(address _feePayoutAddress) external onlyOwner {
      require(_feePayoutAddress != address(0), "fee payout address cannot be zero");
      feePayoutAddress = _feePayoutAddress;
      emit FeePayoutAddressChanged(_feePayoutAddress);
    }

    /// @notice Returns leaves in the index range [_start, _stop). `_stop` is exclusive,
    function getLeaves(uint256 _start, uint256 _stop) external view returns (uint256[] memory) {
        require(_stop >= _start, "stop before start");
        uint256 _returnSize = _stop - _start;
        uint256[] memory _leavesToReturn = new uint256[](_returnSize);
        for (uint256 _returnIndex = 0; _returnIndex < _returnSize; _returnIndex++) {
            _leavesToReturn[_returnIndex] = leaves[_start + _returnIndex];
        }
        return _leavesToReturn;
    }

    // Hashing functions. Keep these in sync with src/hashing.ts and circuits/common/src/lib.nr.

    function _hashLeaf(address _token, uint256 _amount, uint256 _allSecretsHash) internal pure returns (uint256) {
      return PoseidonT4.hash([uint256(uint160(_token)), _amount, _allSecretsHash]);
    }

    function _insetLeaf(uint256 _leaf) internal {
      uint256 root = LeanIMT.insert(tree, _leaf);
      // tree.size - 1 == leafIndex, this saves us on storage :D
      leaves[tree.size - 1] = _leaf;
      // it exists! so trueeee
      rootHistory[root] = true;
      emit LeafInserted(_leaf);
    }

    /// @notice Caller must first call `approve(address(this), amount)` on the token.
    function stake(address _token, uint256 _amount, uint256 _allSecretsHash) external {
      IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
      uint256 leaf = _hashLeaf(_token, _amount, _allSecretsHash);
      _insetLeaf(leaf);

    }

    function _verifyPublicInputs(uint256 _root, uint256 _nullifier, uint256 _pastTimeStamp, uint256 _futureTimeStamp) internal {
      require(rootHistory[_root], "root provided has not existed in this contract");
      require(nullifiers[_nullifier] == false, "already withdrawn or woken up, nullifier provided was already spent");
      // so a user can be punished for not waking up in time, by proving in zk "they woke up after the wake time" -> _pastTimeStamp > wakeTime
      require(_pastTimeStamp < block.timestamp, " past timestamp is not in the past");
      // so an user can proof in zk: "i woke up before the wakeTime" ->  _futureTimeStamp < wakeTime
      require(_futureTimeStamp > block.timestamp, " future timestamp is not in the future");
      // now it no longer false, so the check above will fail on the second time this nullifier is used
      nullifiers[_nullifier] = true;
    }

    /**
     * @notice lays out the public inputs in the order the circuit expects them, see `main` in circuits/wakestake/src/main.nr
     * public so the ui can debug against it
     * @dev for wake() the withdraw_* inputs are 0 and lose is false, for withdraw() new_leaf is 0
     */
    function formatPublicInputs(
      uint256 _root,
      uint256 _nullifier,
      uint256 _newLeaf,
      uint256 _withdrawAmount,
      address _withdrawRecipient,
      address _withdrawToken,
      uint256 _futureTimeStamp,
      uint256 _pastTimeStamp,
      bool _lose
    ) public pure returns (bytes32[] memory publicInputs) {
      publicInputs = new bytes32[](9);
      publicInputs[0] = bytes32(_root);
      publicInputs[1] = bytes32(_nullifier);
      publicInputs[2] = bytes32(_newLeaf);
      publicInputs[3] = bytes32(_withdrawAmount);
      publicInputs[4] = bytes32(uint256(uint160(_withdrawRecipient)));
      publicInputs[5] = bytes32(uint256(uint160(_withdrawToken)));
      publicInputs[6] = bytes32(_futureTimeStamp);
      publicInputs[7] = bytes32(_pastTimeStamp);
      publicInputs[8] = bytes32(uint256(_lose ? 1 : 0));
    }

    /**
     * @notice where a lost stake committed to `_donationAddress` gets paid: a plain wallet gets it directly,
     * a contract (e.g. a friend group) gets asked for its `donationAddress()`, and keeps it if that returns 0
     */
    function getLoserDonationAddress(address _donationAddress) public view returns (address) {
      // a typed call to a wallet reverts, which would make the stake impossible to slash
      if (_donationAddress.code.length == 0) return _donationAddress;
      address donationAddress = IDonationAddressProvider(_donationAddress).donationAddress();
      return donationAddress == address(0) ? _donationAddress : donationAddress;
    }

    /// @param _lose true when the owner woke up too late, the circuit forces _recipient to be the donation address then.
    /// The stake minus the fee then goes to getLoserDonationAddress(_recipient).
    function withdraw(address _recipient, address _token, uint256 _amount, uint256 _root, uint256 _nullifier, uint256 _pastTimeStamp, uint256 _futureTimeStamp, bool _lose, bytes calldata _proof) external {
      _verifyPublicInputs(_root,_nullifier,_pastTimeStamp,_futureTimeStamp);

      bytes32[] memory publicInputs = formatPublicInputs(_root, _nullifier, 0, _amount, _recipient, _token, _futureTimeStamp, _pastTimeStamp, _lose);
      require(verifier.verify(_proof, publicInputs), "invalid proof");

      // nullifier is already marked spent in _verifyPublicInputs, so this is safe against reentrancy
      uint256 fee = _lose ? _amount * feePercentage / 100 : 0;
      address payoutAddress = _lose ? getLoserDonationAddress(_recipient) : _recipient;
      if (fee > 0) IERC20(_token).safeTransfer(feePayoutAddress, fee);
      IERC20(_token).safeTransfer(payoutAddress, _amount - fee);
      // donationAddress == donationGroup when the group returned 0 or _recipient is a plain wallet
      if (_lose) emit YouLose(payoutAddress, _recipient, _token, _amount - fee);
    }

    /**
     * same as withdraw, but instead of sending tokens out it inserts a new leaf into the tree with the same amount and token deposited
     * but a new wake timer
     * @param _newleaf new commitment with the same token and amount but a new wake time
     * @param _root a past root of the tree that contains the old leaf
     * @param _nullifier nullifier of the old leaf
     * @param _pastTimeStamp timestamp that must be in the past
     * @param _futureTimeStamp timestamp that must be in the future
     * @param _proof zk proof
     */
    function wake(uint256 _newleaf, uint256 _root, uint256 _nullifier, uint256 _pastTimeStamp, uint256 _futureTimeStamp, bytes calldata _proof) external {
      _verifyPublicInputs(_root,_nullifier,_pastTimeStamp,_futureTimeStamp);

      bytes32[] memory publicInputs = formatPublicInputs(_root, _nullifier, _newleaf, 0, address(0), address(0), _futureTimeStamp, _pastTimeStamp, false);
      require(verifier.verify(_proof, publicInputs), "invalid proof");

      // proof has proven we woken up before the alarm and that we have committed to a valid _newleaf
      // tree.size - 1 == leafIndex, this saves us on storage :D
      _insetLeaf(_newleaf);
    }
}
