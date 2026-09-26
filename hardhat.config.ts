import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

// ENSv2's registry contracts (lib/contracts-v2 submodule) pin 0.8.25, built with ENS's own settings
const ENSV2_COMPILER = {
  version: "0.8.25",
  settings: { optimizer: { enabled: true, runs: 1000 }, evmVersion: "cancun" },
};

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    // emit artifacts for the linked libraries so Ignition and tests can deploy them
    npmFilesToBuild: [
      "poseidon-solidity/PoseidonT3.sol",
      "poseidon-solidity/PoseidonT4.sol",
      "@zk-kit/lean-imt.sol/LeanIMT.sol",
    ],
    profiles: {
      default: {
        compilers: [{ version: "0.8.34" }, ENSV2_COMPILER],
      },
      production: {
        compilers: [
          {
            version: "0.8.34",
            settings: {
              optimizer: {
                enabled: true,
                runs: 200,
              },
            },
          },
          ENSV2_COMPILER,
        ],
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
  verify: {
    etherscan: {
      apiKey: configVariable("ETHERSCAN_API_KEY"),
    },
  },
});
