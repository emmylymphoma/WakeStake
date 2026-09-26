import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import { UNISWAP_SEPOLIA } from "../../src/uniswap.js";

// A charity's DonationRouter plus a demo token for the charity to receive ("cUSD").
// For a real charity, pass its real receiving token (e.g. USDC) as `donationToken` instead.
export default buildModule("DonationRouterModule", (m) => {
  const charity = m.getParameter("charity", m.getAccount(0));
  const swapRouter = m.getParameter("swapRouter", UNISWAP_SEPOLIA.swapRouter02);
  const charityToken = m.contract("MockERC20", ["Charity USD", "cUSD"], { id: "CharityToken" });
  const donationRouter = m.contract("DonationRouter", [swapRouter, charity, charityToken]);
  return { donationRouter, charityToken };
});
