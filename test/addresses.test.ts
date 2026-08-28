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
  it("Ethereum, Base, Robinhood, and HyperEVM are deployed in this release", () => {
    assert.deepEqual(getSupportedChainIds(), [
      ChainId.ETHEREUM,
      ChainId.BASE,
      ChainId.ROBINHOOD,
      ChainId.HYPEREVM,
    ]);
    assert.equal(isChainSupported(ChainId.ETHEREUM), true);
    assert.equal(isChainSupported(ChainId.BASE), true);
    assert.equal(isChainSupported(ChainId.ROBINHOOD), true);
    assert.equal(isChainSupported(ChainId.HYPEREVM), true);
    assert.equal(isChainSupported(ChainId.ARBITRUM), false);
    assert.equal(getAddresses(ChainId.ARBITRUM), undefined);
  });

  it("deployed chains share protocol addresses", () => {
    const eth = ADDRESSES[ChainId.ETHEREUM];
    const base = ADDRESSES[ChainId.BASE];
    const robinhood = ADDRESSES[ChainId.ROBINHOOD];
    const hyper = ADDRESSES[ChainId.HYPEREVM];

    assert.equal(eth.factory, base.factory);
    assert.equal(eth.factory, robinhood.factory);
    assert.equal(eth.factory, hyper.factory);
    assert.equal(eth.simpleRouter, base.simpleRouter);
    assert.equal(eth.quoter, base.quoter);
    assert.equal(
      eth.extensions.depositAllowlistExtension,
      base.extensions.depositAllowlistExtension,
    );

    assert.notEqual(eth.wrappedNative, base.wrappedNative);
    assert.notEqual(eth.wrappedNative, robinhood.wrappedNative);
    assert.notEqual(eth.wrappedNative, hyper.wrappedNative);
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
    assert.throws(
      () => getAddressesOrThrow(ChainId.ARBITRUM),
      /Ethereum, Base, Robinhood, and HyperEVM are configured/,
    );
  });
});
