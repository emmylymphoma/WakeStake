// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

// ENSv2 contracts from the lib/contracts-v2 submodule, for deploying ENSv2 locally in tests.
// Hardhat only emits artifacts for contracts declared in project files, so each one is a subclass that
// adds nothing, it only passes the constructor arguments through.
// On Sepolia, use ENS's deployed ones instead: https://docs.ens.domains/learn/deployments
import {IContractNamer} from "@ensdomains/contracts-v2/reverse-registrar/interfaces/IContractNamer.sol";
import {LabelStore} from "@ensdomains/contracts-v2/utils/LabelStore.sol";
import {ILabelStore} from "@ensdomains/contracts-v2/utils/interfaces/ILabelStore.sol";
import {UserRegistry} from "@ensdomains/contracts-v2/registry/UserRegistry.sol";
import {VerifiableFactory} from "@ensdomains/verifiable-factory/VerifiableFactory.sol";

contract EnsV2LabelStore is LabelStore {
    constructor(IContractNamer _contractNamer) LabelStore(_contractNamer) {}
}

contract EnsV2UserRegistry is UserRegistry {
    constructor(ILabelStore _labelStore, address _namer) UserRegistry(_labelStore, _namer) {}
}

contract EnsV2VerifiableFactory is VerifiableFactory {}
