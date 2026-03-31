import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Full deployment module that deploys all Metric OMM infrastructure
 * in sequential order to avoid nonce conflicts:
 *
 *   1. Factory           – MetricOmmPoolFactory
 *   2. PoolDeployer       – MetricOmmPoolDeployer (needs factory)
 *   3. setPoolDeployer    – Link deployer to factory
 *   4. Router             – MetricOmmSwapRouter (after step 3)
 *   5. StateView          – MetricOmmPoolStateView (after step 4)
 */
const FullDeploymentModule = buildModule("FullDeployment", (m) => {
  // Parameters
  const owner = m.getParameter("owner");
  const protocolFee = m.getParameter("protocolFee");
  const weth = m.getParameter("weth");

  const factory = m.contract("MetricOmmPoolFactory", [owner, protocolFee]);

  const poolDeployer = m.contract("MetricOmmPoolDeployer", [factory], {
    after: [factory],
  });

  const setPoolDeployerCall = m.call(factory, "setPoolDeployer", [poolDeployer], {
    after: [poolDeployer],
  });

  const router = m.contract("MetricOmmSwapRouter", [weth], {
    after: [setPoolDeployerCall],
  });

  const stateView = m.contract("MetricOmmPoolStateView", [], {
    after: [router],
  });

  return { factory, poolDeployer, router, stateView };
});

export default FullDeploymentModule;
