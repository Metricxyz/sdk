import type { HardhatUserConfig } from "hardhat/config";

import hardhatViem from "@nomicfoundation/hardhat-viem";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";

const config: HardhatUserConfig = {
  plugins: [hardhatViem, hardhatNetworkHelpers, hardhatNodeTestRunner],
  solidity: {
    profiles: {
      default: {
        version: "0.8.35",
        settings: {
          viaIR: true,
          evmVersion: "cancun",
          optimizer: { enabled: true, runs: 200 },
        },
      },
    },
    npmFilesToBuild: [
      // @metric/periphery pin: package.json metricPeripheryRef; cloned by init:submodules (maintainers only)
      "@metric/core/contracts/MetricOmmPool.sol",
      "@metric/core/contracts/MetricOmmPoolFactory.sol",
      "@metric/core/contracts/MetricOmmPoolDeployer.sol",
      "@metric/core/contracts/libraries/LiquidityLib.sol",
      "@metric/core/contracts/Extsload.sol",
      "@metric/core/test/mocks/MockERC20.sol",
      "@metric/core/test/mocks/MockOracle.sol",
      "@metric/core/test/mocks/TestCaller.sol",
      "@metric/core/contracts/interfaces/IPriceProvider/IPriceProvider.sol",
      "@metric/periphery/contracts/lens/MetricOmmPoolDataProvider.sol",
      "@metric/periphery/contracts/lens/MetricOmmSwapQuoter.sol",
      "@metric/periphery/contracts/MetricOmmSimpleRouter.sol",
      "@metric/periphery/contracts/MetricOmmPoolLiquidityAdder.sol",
      "@metric/periphery/contracts/extensions/DepositAllowlistExtension.sol",
      "@metric/periphery/contracts/extensions/SwapAllowlistExtension.sol",
      "@metric/periphery/contracts/extensions/PriceVelocityGuardExtension.sol",
      "@metric/periphery/contracts/extensions/OracleValueStopLossExtension.sol",
      "@metric/periphery/test/mocks/MockWETH9.sol",
    ],
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      allowUnlimitedContractSize: true,
    },
  },
  paths: {
    tests: "./test",
  },
};

export default config;
