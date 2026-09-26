import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Mintable ERC20 for demos: the app mints itself what it needs when VITE_MINT_TEST_TOKENS=1.
export default buildModule("TestTokenModule", (m) => {
  const token = m.contract("MockERC20", ["WakeStake Test USD", "wUSD"]);
  return { token };
});
