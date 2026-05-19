/**
 * Enable big blocks on HyperEVM for the deployer address.
 *
 * HyperEVM has a dual-block architecture:
 *   - Fast blocks: 1s, 2M gas limit
 *   - Slow (big) blocks: 1min, 30M gas limit
 *
 * Large contract deployments require big blocks. This script sends the
 * `evmUserModify` action to HyperCore to flip the `usingBigBlocks` flag.
 *
 * Usage:
 *   npx hardhat run scripts/hyperEvm/set-big-blocks.ts --network hyperEvm
 *
 * Pass --disable to switch back to small/fast blocks:
 *   npx hardhat run scripts/hyperEvm/set-big-blocks.ts --network hyperEvm -- --disable
 */

import { network } from "hardhat";
import { encode } from "@msgpack/msgpack";
import { keccak256 } from "viem";

const EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";

// HyperLiquid EIP-712 domain for mainnet action signing
const EIP712_DOMAIN = {
  name: "Exchange",
  version: "1",
  chainId: 1337,
  verifyingContract: "0x0000000000000000000000000000000000000000" as const,
};

const EIP712_TYPES = {
  Agent: [
    { name: "source", type: "string" },
    { name: "connectionId", type: "bytes32" },
  ],
} as const;

function nonceToBytes(nonce: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(nonce));
  return new Uint8Array(buf);
}

async function main() {
  const { viem } = await network.connect();
  const [walletClient] = await viem.getWalletClients();
  const address = walletClient.account.address;

  const disable = process.argv.includes("--disable");
  const usingBigBlocks = !disable;

  console.log(`Address:        ${address}`);
  console.log(`usingBigBlocks: ${usingBigBlocks}`);

  const action = { type: "evmUserModify", usingBigBlocks };
  const nonce = Date.now();

  // Hash: keccak256(msgpack(action) || nonce_be_8bytes || 0x00)
  // The trailing 0x00 is the null-vault-address marker per HyperLiquid's signing spec.
  const actionBytes = encode(action);
  const nonceBytes = nonceToBytes(nonce);
  const vaultByte = new Uint8Array([0x00]);
  const combined = new Uint8Array(actionBytes.length + nonceBytes.length + vaultByte.length);
  combined.set(new Uint8Array(actionBytes), 0);
  combined.set(nonceBytes, actionBytes.length);
  combined.set(vaultByte, actionBytes.length + nonceBytes.length);
  const connectionId = keccak256(combined);

  // EIP-712 phantom-agent signature via Hardhat keystore account
  const signature = await walletClient.signTypedData({
    account: walletClient.account,
    domain: EIP712_DOMAIN,
    types: EIP712_TYPES,
    primaryType: "Agent",
    message: { source: "a", connectionId },
  });

  const r = ("0x" + signature.slice(2, 66)) as `0x${string}`;
  const s = ("0x" + signature.slice(66, 130)) as `0x${string}`;
  const v = parseInt(signature.slice(130, 132), 16);

  const payload = {
    action,
    nonce,
    signature: { r, s, v },
    vaultAddress: null,
  };

  console.log("\nSending evmUserModify action to HyperCore...\n");

  const response = await fetch(EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.text();
  console.log(`Status:   ${response.status}`);
  console.log(`Response: ${result}`);

  if (response.ok && result.includes("ok")) {
    console.log(
      usingBigBlocks
        ? "\nBig blocks enabled. You can now deploy large contracts on HyperEVM."
        : "\nBig blocks disabled. Transactions will target fast blocks.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
