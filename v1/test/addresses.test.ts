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
      assert.equal(addresses.simpleRouter, eth.simpleRouter);
      assert.equal(addresses.quoter, eth.quoter);
      assert.equal(
        addresses.extensions.depositAllowlistExtension,
        eth.extensions.depositAllowlistExtension,
      );
    }

    assert.equal(eth.factory, "0xA32761549A1DE40060c194C86A8df24f0A29bA2d");
    assert.equal(eth.simpleRouter, "0x7D4fb51164288D2e1fdA2032D887517F71008b89");
  });

  it("getAddressesOrThrow returns bundled deployment for configured chains", () => {
    for (const chainId of getSupportedChainIds()) {
      const addresses = getAddressesOrThrow(chainId);
      assert.equal(addresses.factory, ADDRESSES[chainId].factory);
      assert.equal(addresses.dataProvider, ADDRESSES[chainId].dataProvider);
      assert.equal(addresses.simpleRouter, ADDRESSES[chainId].simpleRouter);
      assert.equal(isChainDeployed(chainId), true);
    }
  });

  it("getAddressesOrThrow rejects unsupported chains", () => {
    assert.throws(() => getAddressesOrThrow(10), /Chain 10 has no v1 deployment in this SDK/);
  });
});
