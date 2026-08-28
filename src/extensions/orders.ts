import type { ExtensionOrders } from "./types.js";
import { EMPTY_EXTENSION_ORDERS } from "./types.js";

/** Pack up to seven 3-bit extension indices (0 = end of sequence). */
export function encodeExtensionOrder(slots: readonly number[]): bigint {
  if (slots.length > 7) {
    throw new Error("encodeExtensionOrder accepts at most 7 slots");
  }

  let order = 0n;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!Number.isInteger(slot) || slot < 0 || slot > 7) {
      throw new Error(`encodeExtensionOrder slot ${i} must be an integer in [0, 7]`);
    }
    order |= BigInt(slot) << BigInt(i * 3);
  }
  return order;
}

export type ExtensionOrderAction = keyof ExtensionOrders;

/** Build extension orders from per-action slot arrays. Omitted actions default to zero. */
export function buildExtensionOrders(
  partial: Partial<Record<ExtensionOrderAction, readonly number[]>>,
): ExtensionOrders {
  return {
    ...EMPTY_EXTENSION_ORDERS,
    ...Object.fromEntries(
      Object.entries(partial).map(([action, slots]) => [action, encodeExtensionOrder(slots ?? [])]),
    ),
  } as ExtensionOrders;
}
