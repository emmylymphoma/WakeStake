// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {LeanIMT, LeanIMTData} from "@zk-kit/lean-imt.sol/LeanIMT.sol";
import {PoseidonT4} from "poseidon-solidity/PoseidonT4.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract WakeStake {
    using LeanIMT for LeanIMTData;
    using SafeERC20 for IERC20;

    LeanIMTData internal tree;

    // event indexing is a pain and not needed for hackathons!!!
    mapping(uint256 index => uint256 leaf) public leaves;
    mapping (uint256 root => bool itExists) public rootHistory;
    mapping (uint256 nulifier => bool itExists) nullifiers;


    event LeafInserted(uint256 indexed leaf);

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

    // Hashing functions. Keep these in sync with src/hashing.ts and circuits/src/main.nr.

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

      // TODO format public inputs
      // TODO verify proof
    }

    function withdraw(address _recipient, address _token, uint256 _amount, uint256 _root, uint256 _nullifier, uint256 _pastTimeStamp, uint256 _futureTimeStamp, bytes calldata _proof) external {
      _verifyPublicInputs(_root,_nullifier,_pastTimeStamp,_futureTimeStamp);

      // TODO format public inputs
      // TODO verify proof

      // nullifier is already marked spent in _verifyPublicInputs, so this is safe against reentrancy
      IERC20(_token).safeTransfer(_recipient, _amount);
    }

    /**
     * same as withdraw, but instead of sending tokens out it inserts a new leaf into the tree with the same amount and token deposited
     * but a new wake timer
     * @param _newleaf new commitment with the same token and amount but a new wake time
     * @param _root a past root of the tree that contains the old leaf
     * @param _nullifier nullifier of the old leaf
     * @param _pastTimeStamp timestamp that must be in the past
     * @param _futureTimeStamp timestamp that must be in the future
     * @param _proof zk proof (not verified yet)
     */
    function wake(uint256 _newleaf, uint256 _root, uint256 _nullifier, uint256 _pastTimeStamp, uint256 _futureTimeStamp, bytes calldata _proof) external {
      _verifyPublicInputs(_root,_nullifier,_pastTimeStamp,_futureTimeStamp);
      
      // TODO format public inputs
      // TODO verify proof

      // proof has proven we woken up before the alarm and that we have committed to a valid _newleaf
      // tree.size - 1 == leafIndex, this saves us on storage :D
      _insetLeaf(_newleaf);
      uint256 _recipient = 0;
    }
}
