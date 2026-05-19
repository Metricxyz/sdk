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
  it("only Ethereum mainnet is deployed in this release", () => {
    assert.deepEqual(getSupportedChainIds(), [ChainId.ETHEREUM]);
    assert.equal(isChainSupported(ChainId.ETHEREUM), true);
    assert.equal(isChainSupported(ChainId.BASE), false);
    assert.equal(getAddresses(ChainId.BASE), undefined);
  });

  it("getAddressesOrThrow returns bundled mainnet deployment for Ethereum", () => {
    const a = getAddressesOrThrow(ChainId.ETHEREUM);
    assert.equal(a.factory, ADDRESSES[ChainId.ETHEREUM].factory);
    assert.equal(a.dataProvider, ADDRESSES[ChainId.ETHEREUM].dataProvider);
    assert.equal(a.swapper, ADDRESSES[ChainId.ETHEREUM].swapper);
    assert.equal(isChainDeployed(ChainId.ETHEREUM), true);
  });

  it("getAddressesOrThrow rejects unsupported chains", () => {
    assert.throws(() => getAddressesOrThrow(ChainId.ARBITRUM), /only Ethereum mainnet/);
  });
});
