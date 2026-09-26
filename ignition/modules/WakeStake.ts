import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { hexToBigInt, labelhash, zeroAddress } from "viem";

import { ENS_ROLES, ENS_ROOT_LABEL, ENS_SEPOLIA } from "../../src/constants.js";

/** WakeStake.ADMIN_LABEL: whoever owns admin.wakestake.eth is WakeStake's admin */
const ADMIN_LABEL = "admin";
/** same roles as DonationGroup.NAME_ROLES: transferable, and free to set its own resolver */
const ADMIN_NAME_ROLES = ENS_ROLES.CAN_TRANSFER_ADMIN | ENS_ROLES.SET_RESOLVER | ENS_ROLES.SET_RESOLVER_ADMIN;
const NEVER_EXPIRES = 2n ** 64n - 1n;

export default buildModule("WakeStakeModule", (m) => {
  // LeanIMT hashes tree nodes with PoseidonT3, WakeStake hashes leaves with PoseidonT4.
  // All three are libraries with public functions, so they must be deployed and linked.
  const poseidonT3 = m.library("PoseidonT3");
  const poseidonT4 = m.library("PoseidonT4");
  const leanIMT = m.library("LeanIMT", {
    libraries: { PoseidonT3: poseidonT3 },
  });

  // Each generated verifier links two of its own libraries, prefixed per circuit by circuits/buildVerifiers.sh.
  const verifier = m.contract("WakeStakeVerifier", [], {
    libraries: {
      WakeStakeRelationsLib: m.library("WakeStakeRelationsLib"),
      WakeStakeZKTranscriptLib: m.library("WakeStakeZKTranscriptLib"),
    },
  });
  const stakeOwnershipVerifier = m.contract("StakeOwnershipVerifier", [], {
    libraries: {
      StakeOwnershipRelationsLib: m.library("StakeOwnershipRelationsLib"),
      StakeOwnershipZKTranscriptLib: m.library("StakeOwnershipZKTranscriptLib"),
    },
  });

  // set in ignition/parameters.json, defaults to the deployer (account 0) and 5%
  const admin = m.getParameter("admin", m.getAccount(0));
  const feePayoutAddress = m.getParameter("feePayoutAddress", m.getAccount(0));
  const feePercentage = m.getParameter("feePercentage", 5n);

  // ENSv2: defaults to ENS's Sepolia deployment, tests pass locally deployed ones (see contracts/ens/EnsV2.sol)
  const verifiableFactory = m.contractAt(
    "EnsV2VerifiableFactory",
    m.getParameter("ensVerifiableFactory", ENS_SEPOLIA.verifiableFactory),
  );
  const userRegistryImplementation = m.contractAt(
    "EnsV2UserRegistry",
    m.getParameter("ensUserRegistryImplementation", ENS_SEPOLIA.userRegistryImplementation),
  );

  // the registry of *.wakestake.eth, with the deployer (the owner of wakestake.eth) holding every role.
  // On Sepolia, point wakestake.eth at it with `pnpm ens:link`.
  const deployWakeStakeRegistry = m.call(verifiableFactory, "deployProxy", [
    userRegistryImplementation,
    hexToBigInt(labelhash(ENS_ROOT_LABEL)),
    m.encodeFunctionCall(userRegistryImplementation, "initialize", [
      [{ account: m.getAccount(0), roleBitmap: ENS_ROLES.ALL }],
    ]),
  ]);
  const wakeStakeRegistry = m.contractAt(
    "EnsV2UserRegistry",
    m.readEventArgument(deployWakeStakeRegistry, "ProxyDeployed", "proxyAddress"),
    { id: "WakeStakeRegistry" },
  );

  // admin.wakestake.eth makes its owner WakeStake's admin, like admin.<group>.wakestake.eth does for a group.
  // Registered by the deployer, who holds ROLE_REGISTRAR on the registry. Transfer the name to hand over admin.
  m.call(
    wakeStakeRegistry,
    "register",
    [ADMIN_LABEL, admin, zeroAddress, zeroAddress, ADMIN_NAME_ROLES, NEVER_EXPIRES],
    { id: "RegisterAdminName" },
  );

  const wakeStake = m.contract("WakeStake", [verifier, wakeStakeRegistry, feePayoutAddress, feePercentage], {
    libraries: { LeanIMT: leanIMT, PoseidonT4: poseidonT4 },
  });

  const donationGroupFactory = m.contract("DonationGroupFactory", [
    wakeStake,
    stakeOwnershipVerifier,
    wakeStakeRegistry,
    verifiableFactory,
    userRegistryImplementation,
  ]);
  // only the factory can hand out <group>.wakestake.eth, so only factory-made groups get a name
  m.call(wakeStakeRegistry, "grantRootRoles", [ENS_ROLES.REGISTRAR, donationGroupFactory]);

  return {
    wakeStake,
    verifier,
    stakeOwnershipVerifier,
    leanIMT,
    poseidonT3,
    poseidonT4,
    donationGroupFactory,
    wakeStakeRegistry,
  };
});
