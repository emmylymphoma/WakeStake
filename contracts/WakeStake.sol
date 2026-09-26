// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {LeanIMT, LeanIMTData} from "@zk-kit/lean-imt.sol/LeanIMT.sol";
import {PoseidonT4} from "poseidon-solidity/PoseidonT4.sol";

contract WakeStake {
    using LeanIMT for LeanIMTData;

    LeanIMTData internal tree;

    mapping(uint256 index => uint256 leaf) public leaves;
    mapping (uint256 root => bool itExists) rootHistory;
    mapping (uint256 nulifier => bool itExists) nullifiers;


    event LeafInserted(uint256 indexed leaf, uint256 indexed index, uint256 root);

    /// @notice Returns leaves in the index range [_start, _stop). `_stop` is exclusive,
    function getLeaves(uint256 _start, uint256 _stop) external view returns (uint256[] memory) {
        require(_stop >= _start, "stop before start");
        uint256 returnSize = _stop - _start;
        uint256[] memory _leavesToReturn = new uint256[](returnSize);
        for (uint256 _returnIndex = 0; _returnIndex < returnSize; _returnIndex++) {
            _leavesToReturn[_returnIndex] = leaves[_start + _returnIndex];
        }
        return _leavesToReturn;
    }

    function stake(address token, uint256 amount, uint256 hashedSecrets) external {
      uint256 leaf = PoseidonT4.hash([uint256(uint160(token)), amount, hashedSecrets]);
      uint256 root = LeanIMT.insert(tree, leaf);
      // tree.size - 1 == leafIndex, this saves us on storage :D
      leaves[tree.size - 1] = leaf;
      // it exists! so trueeee
      rootHistory[root] = true;
    }

    function _verifyPublicInputs(uint256 _root, uint256 _nullifier, uint256 _pastTimeStamp, uint256 _futureTimeStamp) {
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
    }

    /**
     * same as withdraw, but instead of sending tokens out it inserts a new leaf into the tree with the same amount and token deposited
     * but a new wake timer
     * @param _newleaf 
     * @param _root 
     * @param _nullifier 
     * @param _proof 
     */
    function wake(uint256 _newleaf, uint256 _root, uint256 _nullifier, bytes calldata _proof) external {
      _verifyPublicInputs(_root,_nullifier,_pastTimeStamp,_futureTimeStamp);
      
      // TODO format public inputs
      // TODO verify proof

      // proof has proven we woken up before the alarm and that we have committed to a valid _newleaf
      // tree.size - 1 == leafIndex, this saves us on storage :D
      leaves[tree.size - 1] = _newleaf;
    }
}
