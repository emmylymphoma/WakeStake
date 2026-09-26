import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("WakeStakeModule", (m) => {
  // LeanIMT hashes tree nodes with PoseidonT3, WakeStake hashes leaves with PoseidonT4.
  // All three are libraries with public functions, so they must be deployed and linked.
  const poseidonT3 = m.library("PoseidonT3");
  const poseidonT4 = m.library("PoseidonT4");
  const leanIMT = m.library("LeanIMT", {
    libraries: { PoseidonT3: poseidonT3 },
  });

  // The generated HonkVerifier (WakeStakeVerifier.sol) links two of its own libraries.
  const relationsLib = m.library("RelationsLib");
  const zkTranscriptLib = m.library("ZKTranscriptLib");
  const verifier = m.contract("HonkVerifier", [], {
    libraries: { RelationsLib: relationsLib, ZKTranscriptLib: zkTranscriptLib },
  });

  // set in ignition/parameters.json, defaults to the deployer (account 0) and 5%
  const owner = m.getParameter("owner", m.getAccount(0));
  const feePayoutAddress = m.getParameter("feePayoutAddress", m.getAccount(0));
  const feePercentage = m.getParameter("feePercentage", 5n);

  const wakeStake = m.contract("WakeStake", [verifier, owner, feePayoutAddress, feePercentage], {
    libraries: { LeanIMT: leanIMT, PoseidonT4: poseidonT4 },
  });

  const donationGroupFactory = m.contract("DonationGroupFactory");

  return { wakeStake, verifier, leanIMT, poseidonT3, poseidonT4, donationGroupFactory };
});
