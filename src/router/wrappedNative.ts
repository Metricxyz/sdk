import { isAddress, isAddressEqual, zeroAddress, type Address } from "viem";
import { getAddressesOrThrow } from "../addresses.js";

/** Both null explicitly disable validation; a supplied chain and token must agree. */
export function assertWrappedNativeToken(
  token: Address | undefined,
  chainId: number | null,
  wrappedNative: Address | null,
  tokenName: "tokenIn" | "tokenOut",
): void {
  if (chainId === null && wrappedNative === null) return;

  if (
    wrappedNative !== null &&
    (!wrappedNative ||
      !isAddress(wrappedNative, { strict: false }) ||
      isAddressEqual(wrappedNative, zeroAddress))
  ) {
    throw new Error("wrappedNative must be a non-zero token address");
  }

  let expected = wrappedNative;
  if (chainId !== null) {
    const chainWrappedNative = getAddressesOrThrow(chainId).wrappedNative;
    if (wrappedNative !== null && !isAddressEqual(wrappedNative, chainWrappedNative)) {
      throw new Error(`wrappedNative does not match chainId ${chainId}`);
    }
    expected = chainWrappedNative;
  }

  if (
    !token ||
    !isAddress(token, { strict: false }) ||
    !expected ||
    !isAddressEqual(token, expected)
  ) {
    throw new Error(`${tokenName} must be wrappedNative`);
  }
}
