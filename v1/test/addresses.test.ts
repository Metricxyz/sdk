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
  it("Ethereum and Base are deployed in this release", () => {
    assert.deepEqual(getSupportedChainIds(), [ChainId.ETHEREUM, ChainId.BASE]);
    assert.equal(isChainSupported(ChainId.ETHEREUM), true);
    assert.equal(isChainSupported(ChainId.BASE), true);
    assert.equal(isChainSupported(ChainId.ARBITRUM), false);
    assert.equal(getAddresses(ChainId.ARBITRUM), undefined);
  });

  it("Ethereum and Base share protocol addresses", () => {
    const eth = ADDRESSES[ChainId.ETHEREUM];
    const base = ADDRESSES[ChainId.BASE];

    assert.equal(eth.factory, base.factory);
    assert.equal(eth.simpleRouter, base.simpleRouter);
    assert.equal(eth.quoter, base.quoter);
    assert.equal(
      eth.extensions.depositAllowlistExtension,
      base.extensions.depositAllowlistExtension,
    );

    assert.notEqual(eth.wrappedNative, base.wrappedNative);
  });

  it("getAddressesOrThrow returns bundled deployment for Ethereum and Base", () => {
    const eth = getAddressesOrThrow(ChainId.ETHEREUM);
    assert.equal(eth.factory, ADDRESSES[ChainId.ETHEREUM].factory);
    assert.equal(eth.dataProvider, ADDRESSES[ChainId.ETHEREUM].dataProvider);
    assert.equal(eth.simpleRouter, ADDRESSES[ChainId.ETHEREUM].simpleRouter);
    assert.equal(isChainDeployed(ChainId.ETHEREUM), true);

    const base = getAddressesOrThrow(ChainId.BASE);
    assert.equal(base.factory, ADDRESSES[ChainId.BASE].factory);
    assert.equal(isChainDeployed(ChainId.BASE), true);
  });

  it("getAddressesOrThrow rejects unsupported chains", () => {
    assert.throws(() => getAddressesOrThrow(ChainId.ARBITRUM), /Ethereum and Base are configured/);
  });
});
