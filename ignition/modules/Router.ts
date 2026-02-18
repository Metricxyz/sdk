import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for deploying the MetricOmmSwapRouter.
 *
 * Parameters:
 *   - weth: WETH address for native ETH wrap/unwrap functionality (required)
 */
const RouterModule = buildModule("Router", (m) => {
  const weth = m.getParameter("weth");

  const router = m.contract("MetricOmmSwapRouter", [weth]);

  return { router };
});

export default RouterModule;
