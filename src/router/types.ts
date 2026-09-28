import type { Address, Hex, PublicClient } from "viem";

/**
 * Arguments for `MetricOmmSimpleRouter.exactInputSingle`.
 * Pass to `encodeExactInputSingleCalldata` or native prepare helpers when `tokenIn` is WETH.
 */
export type ExactInputSingleParams = {
  /** Pool to swap through. */
  pool: Address;
  /** Input token (`addresses.wrappedNative` when swapping from native ETH). */
  tokenIn: Address;
  /** Output token (`addresses.wrappedNative` when unwrapping to ETH in a follow-up call). */
  tokenOut: Address;
  /** `true` when swapping token0 → token1 for this pool. */
  zeroForOne: boolean;
  /** Exact input amount in `tokenIn` native decimals. */
  amountIn: bigint;
  /** Minimum acceptable output; reverts if less is received. */
  amountOutMinimum: bigint;
  /** Address that receives output tokens. */
  recipient: Address;
  /** Unix timestamp after which the swap reverts. */
  deadline: bigint;
  /** Q64.64 price bound; use `0` / `MAX_UINT128` defaults from builders when unsure. */
  priceLimitX64: bigint;
  /** Per-pool extension calldata; omit for pools without extensions. */
  extensionData?: Hex;
};

/**
 * Arguments for `MetricOmmSimpleRouter.exactOutputSingle`.
 */
export type ExactOutputSingleParams = {
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  zeroForOne: boolean;
  /** Exact output amount in `tokenOut` native decimals. */
  amountOut: bigint;
  /** Maximum input willing to spend (slippage cap). */
  amountInMaximum: bigint;
  recipient: Address;
  deadline: bigint;
  priceLimitX64: bigint;
  extensionData?: Hex;
};

/**
 * Inputs for {@link buildExactInputSingleParams}.
 * Quotes live on-chain via the SwapQuoter and applies `slippagePercent` to derive `amountOutMinimum`.
 */
export interface BuildExactInputSingleParams {
  publicClient: PublicClient;
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  recipient: Address;
  /** Address the quoter should forward to swap extensions; defaults to recipient. */
  sender?: Address;
  /** Input amount in `tokenIn` decimals (wei for ETH / WETH). */
  amountIn: bigint;
  /** Human-readable slippage tolerance, e.g. `0.5` = 0.5%. */
  slippagePercent: number;
  /** Optional price bound; defaults from quoter direction when omitted. */
  priceLimitX64?: bigint;
  deadline: bigint;
  extensionData?: Hex;
  /** Override when `addresses.quoter` is unset. */
  quoterAddress?: Address;
  /** `addresses.wrappedNative` — required when `tokenIn` or `tokenOut` is native (zero address). */
  wrappedNative?: Address;
}

/** Inputs for {@link buildExactOutputSingleParams}. */
export interface BuildExactOutputSingleParams {
  publicClient: PublicClient;
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  recipient: Address;
  sender?: Address;
  amountOut: bigint;
  slippagePercent: number;
  priceLimitX64?: bigint;
  deadline: bigint;
  extensionData?: Hex;
  quoterAddress?: Address;
  wrappedNative?: Address;
}

/**
 * Arguments for `MetricOmmSimpleRouter.exactInput` (multihop exact input).
 * `tokens` and `zeroForOneBitMap` are usually produced by {@link buildExactInputParams}.
 */
export type ExactInputParams = {
  /** Path tokens, length `pools.length + 1`. */
  tokens: Address[];
  /** One pool per hop, in swap order. */
  pools: Address[];
  /** Extension calldata per hop; use `0x` when a pool has no extension. */
  extensionDatas: Hex[];
  /** Bit `i` set when hop `i` is token0 → token1. */
  zeroForOneBitMap: bigint;
  amountIn: bigint;
  amountOutMinimum: bigint;
  recipient: Address;
  deadline: bigint;
};

/** Arguments for `MetricOmmSimpleRouter.exactOutput` (multihop exact output). */
export type ExactOutputParams = {
  tokens: Address[];
  pools: Address[];
  extensionDatas: Hex[];
  zeroForOneBitMap: bigint;
  amountOut: bigint;
  amountInMaximum: bigint;
  recipient: Address;
  deadline: bigint;
};

/** Inputs for {@link buildExactInputParams}. */
export interface BuildExactInputParams {
  publicClient: PublicClient;
  tokenIn: Address;
  tokenOut: Address;
  /** Ordered pool addresses connecting `tokenIn` → `tokenOut`. */
  pools: readonly Address[];
  extensionDatas?: readonly Hex[];
  recipient: Address;
  /** Address the quoter should forward to swap extensions; defaults to recipient. */
  sender?: Address;
  amountIn: bigint;
  slippagePercent: number;
  deadline: bigint;
  quoterAddress?: Address;
  wrappedNative?: Address;
}

/** Inputs for {@link buildExactOutputParams}. */
export interface BuildExactOutputParams {
  publicClient: PublicClient;
  tokenIn: Address;
  tokenOut: Address;
  pools: readonly Address[];
  extensionDatas?: readonly Hex[];
  recipient: Address;
  sender?: Address;
  amountOut: bigint;
  slippagePercent: number;
  deadline: bigint;
  quoterAddress?: Address;
  wrappedNative?: Address;
}

/** Wire tradeType from the route API. */
export type TradeType = "exact_in" | "exact_out";

/** Wire routeType from the route API. */
export type RouteType = "direct" | "one_hop";

/** One hop in a route API response (RouteLegResponse). */
export type RouteLegResponse = {
  tradeType: TradeType;
  poolAddress: string;
  pair: string;
  zeroForOne: boolean;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  effectivePriceX64: string;
  priceImpactE6: string;
  priceLimitX64: string;
};

/** One execution path in a route API response (RouteOptionResponse). */
export type RouteOptionResponse = {
  tradeType: TradeType;
  routeType: RouteType;
  amountIn: string;
  amountOut: string;
  effectivePriceX64: string;
  priceImpactE6: string;
  legs: RouteLegResponse[];
};

/** Route API response (RouteResponse). */
export type RouteResponse = {
  tokenIn: string;
  tokenOut: string;
  tradeType: TradeType;
  amountIn: string;
  amountOut: string;
  effectivePriceX64: string;
  priceImpactBestRoute: string;
  candidatesConsidered: number;
  routes: RouteOptionResponse[];
};

export type PrepareExactInputFromRouteParams = {
  publicClient: PublicClient;
  route: RouteResponse;
  recipient: Address;
  deadline: bigint;
  /** Human-readable slippage tolerance applied to the selected route's `amountOut`, e.g. `0.5` = 0.5%. */
  slippagePercent: number;
  extensionDatas?: readonly Hex[];
};

export type PrepareExactOutputFromRouteParams = {
  publicClient: PublicClient;
  route: RouteResponse;
  recipient: Address;
  deadline: bigint;
  /** Human-readable slippage tolerance applied to the selected route's `amountIn`, e.g. `0.5` = 0.5%. */
  slippagePercent: number;
  extensionDatas?: readonly Hex[];
};

export type PreparedExactInputFromRoute =
  | { kind: "single"; params: ExactInputSingleParams }
  | { kind: "multihop"; params: ExactInputParams };

export type PreparedExactOutputFromRoute =
  | { kind: "single"; params: ExactOutputSingleParams }
  | { kind: "multihop"; params: ExactOutputParams };

export type ExternalSwapParams = {
  tokenIn: Address;
  tokenOut: Address;
  amountInMaximum: bigint;
  amountOutMinimum: bigint;
  externalRouter: Address;
  /** Executor must pay; output must go to the executor or params.recipient. */
  externalRouterCalldata: Hex;
  recipient: Address;
  deadline: bigint;
};

/**
 * externalRouterCalldata MUST be built with primary input/output tokens and limits.
 * externalRouterCalldata MUST be built with executor as payer, NOT router, NOT user.
 * externalRouterCalldata MUST send output to the executor so it can measure the
 * output balance increase and forward the tokens to the final recipient.
 * The SDK cannot validate addresses encoded inside arbitrary external calldata.
 */
export type ExternalSwapFallback = {
  externalRouter: Address;
  externalRouterCalldata: Hex;
  /** Executes the external swap using funds provided by the SimpleRouter. */
  executor: Address;
};

export enum OnStepSuccess {
  CONTINUE,
  STOP,
}

export enum OnStepFailure {
  CONTINUE,
  STOP,
  REVERT,
}

export enum StepStatus {
  NOT_EXECUTED,
  SUCCESS,
  FAILURE,
}

export type SequenceCall = {
  data: Hex;
  onSuccess: OnStepSuccess;
  onFailure: OnStepFailure;
};
