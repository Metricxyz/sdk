import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for deploying the Factory and PoolDeployer infrastructure.
 *
 * Parameters:
 *   - owner: Address that will own the factory (required)
 *   - protocolFee: Default protocol fee for new pools (default: 100_000 = 10%)
 *
 * Deploy order:
 *   1. MetricOmmPoolFactory
 *   2. MetricOmmPoolDeployer (needs factory address)
 *   3. factory.setPoolDeployer(deployer)
 */
const FactoryAndDeployerModule = buildModule("FactoryAndDeployer", (m) => {
  // Parameters
  const owner = m.getParameter("owner");
  const protocolFee = m.getParameter("protocolFee", 100_000); // 10% default

  // 1. Deploy Factory
  const factory = m.contract("MetricOmmPoolFactory", [owner, protocolFee]);

  // 2. Deploy PoolDeployer with factory address
  const poolDeployer = m.contract("MetricOmmPoolDeployer", [factory], {
    after: [factory],
  });

  // 3. Link deployer to factory
  m.call(factory, "setPoolDeployer", [poolDeployer], {
    after: [poolDeployer],
  });

  return { factory, poolDeployer };
});

export default FactoryAndDeployerModule;
