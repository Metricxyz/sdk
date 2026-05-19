import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for deploying the MetricOmmPoolStateView.
 *
 * No constructor parameters required.
 */
const StateViewModule = buildModule("StateView", (m) => {
  const stateView = m.contract("MetricOmmPoolStateView", []);

  return { stateView };
});

export default StateViewModule;
