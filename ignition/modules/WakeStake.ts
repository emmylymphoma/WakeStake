import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("WakeStakeModule", (m) => {
  // LeanIMT hashes tree nodes with PoseidonT3, WakeStake hashes leaves with PoseidonT4.
  // All three are libraries with public functions, so they must be deployed and linked.
  const poseidonT3 = m.library("PoseidonT3");
  const poseidonT4 = m.library("PoseidonT4");
  const leanIMT = m.library("LeanIMT", {
    libraries: { PoseidonT3: poseidonT3 },
  });

  const wakeStake = m.contract("WakeStake", [], {
    libraries: { LeanIMT: leanIMT, PoseidonT4: poseidonT4 },
  });

  return { wakeStake, leanIMT, poseidonT3, poseidonT4 };
});
