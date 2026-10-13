import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ADDRESSES,
  ChainId,
  getAddresses,
  getAddressesOrThrow,
  getSupportedChainIds,
  isChainDeployed,
  isChainSupported,
} from "../src/addresses.js";

describe("v1 addresses", () => {
  it("bundles the ten deployed chains", () => {
    assert.deepEqual(getSupportedChainIds(), [
      ChainId.ETHEREUM,
      ChainId.BASE,
      ChainId.ARBITRUM,
      ChainId.AVALANCHE,
      ChainId.BNB,
      ChainId.POLYGON,
      ChainId.MEGAETH,
      ChainId.HYPEREVM,
      ChainId.MONAD,
      ChainId.ROBINHOOD,
    ]);
    for (const chainId of Object.values(ChainId)) {
      assert.equal(isChainSupported(chainId), true);
      assert.ok(getAddresses(chainId));
    }
  });

  it("deployed chains share protocol addresses", () => {
    const eth = ADDRESSES[ChainId.ETHEREUM];
    for (const chainId of getSupportedChainIds()) {
      const addresses = ADDRESSES[chainId];
      assert.equal(addresses.factory, eth.factory);
      assert.equal(addresses.poolDeployer, eth.poolDeployer);
      assert.equal(addresses.liquidityAdder, eth.liquidityAdder);
      assert.equal(addresses.dataProvider, eth.dataProvider);
      assert.equal(addresses.simpleRouter, eth.simpleRouter);
      assert.equal(addresses.externalSwapExecutor, eth.externalSwapExecutor);
      assert.equal(addresses.quoter, eth.quoter);
      assert.deepEqual(addresses.extensions, eth.extensions);
    }

    assert.deepEqual(
      {
        factory: eth.factory,
        poolDeployer: eth.poolDeployer,
        liquidityAdder: eth.liquidityAdder,
        dataProvider: eth.dataProvider,
        simpleRouter: eth.simpleRouter,
        externalSwapExecutor: eth.externalSwapExecutor,
        quoter: eth.quoter,
        extensions: eth.extensions,
      },
      {
        factory: "0x2a53833cc95548cf52c7b159110e22D3a9018f32",
        poolDeployer: "0x2E0A99A2E352043d1CA489cF45bf7B511BCcC738",
        liquidityAdder: "0x06Cb6C245Cd9219262442A7730D9484B3CfdD901",
        dataProvider: "0x83d66c5934b1525ee82e6E772c76c7acC778bBB7",
        simpleRouter: "0x02201E6f13c41506c7Bb635d7543F98826229aB7",
        externalSwapExecutor: "0x578C80DeC5D4Aa1F2879985e6e8d91Fc268e4AC2",
        quoter: "0x3B9ea79f482094323d06064E637a7F4528560fcb",
        extensions: {
          depositAllowlistExtension: "0x65FBa4Ee8f50772aB384f19e5520DdA420B1B47D",
          swapAllowlistExtension: "0x4Ca8d78873f0a66445CC05f9A1E705f1a58A6582",
          oracleValueStopLossExtension: "0xE4038fA09f0bB9963068afaF97BE0c045155090D",
          priceVelocityGuardExtension: "0xEbc53e61078976118E384f110c262A263decB84B",
        },
      },
    );
  });

  it("getAddressesOrThrow returns bundled deployment for configured chains", () => {
    for (const chainId of getSupportedChainIds()) {
      const addresses = getAddressesOrThrow(chainId);
      assert.equal(addresses.factory, ADDRESSES[chainId].factory);
      assert.equal(addresses.dataProvider, ADDRESSES[chainId].dataProvider);
      assert.equal(addresses.simpleRouter, ADDRESSES[chainId].simpleRouter);
      assert.equal(addresses.externalSwapExecutor, ADDRESSES[chainId].externalSwapExecutor);
      assert.equal(isChainDeployed(chainId), true);
    }
  });

  it("getAddressesOrThrow rejects unsupported chains", () => {
    assert.throws(() => getAddressesOrThrow(10), /Chain 10 has no v1 deployment in this SDK/);
  });
});
