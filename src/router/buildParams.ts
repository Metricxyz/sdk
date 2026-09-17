import type {
  ExactInputSingleParams,
  ExactOutputSingleParams,
  BuildExactInputSingleParams,
  BuildExactOutputSingleParams,
  ExactInputParams,
  ExactOutputParams,
  BuildExactInputParams,
  BuildExactOutputParams,
} from "./types.js";
import { defaultPriceLimitX64, quoteLiveExactIn, quoteLiveExactOut } from "../quoter/quotePath.js";
import { quoteLiveExactInSingle, quoteLiveExactOutSingle } from "../quoter/quote.js";
import { resolveSwapPath } from "../swap/path.js";
import { ceilDiv, toSlippageBps } from "./slippage.js";

const BPS_BASE = 10_000n;

/**
 * Build single-hop exact-input swap params with live quote and slippage.
 *
 * Resolves `zeroForOne`, quotes `amountOut`, and sets `amountOutMinimum`.
 * For native ETH input, use `prepareExactInputSingleSupportingNativePaymentCalldata` and set `msg.value` on the transaction.
 * (params will contain WETH as `tokenIn`).
 *
 * @example
 * ```ts
 * const params = await buildExactInputSingleParams({
 *   publicClient,
 *   pool,
 *   tokenIn: usdc,
 *   tokenOut: weth,
 *   recipient: account,
 *   amountIn: parseUnits("100", 6),
 *   slippagePercent: 0.5,
 *   deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
 *   quoterAddress: addresses.quoter,
 * });
 * await walletClient.writeContract({
 *   address: addresses.simpleRouter,
 *   abi: MetricOmmSimpleRouterAbi,
 *   functionName: "exactInputSingle",
 *   args: [params],
 *   account,
 * });
 * ```
 */
export async function buildExactInputSingleParams(
  params: BuildExactInputSingleParams,
): Promise<ExactInputSingleParams> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const { zeroForOnes } = await resolveSwapPath(
    params.publicClient,
    params.tokenIn,
    params.tokenOut,
    [params.pool],
    params.extensionData ? [params.extensionData] : undefined,
  );
  const zeroForOne = zeroForOnes[0]!;
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(zeroForOne);

  const { amountOut } = await quoteLiveExactInSingle({
    publicClient: params.publicClient,
    pool: params.pool,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    recipient: params.recipient,
    sender: params.sender,
    amountIn: params.amountIn,
    priceLimitX64,
    extensionData: params.extensionData,
    quoterAddress: params.quoterAddress,
  });

  const amountOutMinimum = (amountOut * (BPS_BASE - slippageBps)) / BPS_BASE;

  return {
    pool: params.pool,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    zeroForOne,
    amountIn: params.amountIn,
    amountOutMinimum,
    recipient: params.recipient,
    deadline: params.deadline,
    priceLimitX64,
    extensionData: params.extensionData,
  };
}

/**
 * Build single-hop exact-output swap params with live quote and slippage.
 * Sets `amountInMaximum` from quoted input plus `slippagePercent`.
 */
export async function buildExactOutputSingleParams(
  params: BuildExactOutputSingleParams,
): Promise<ExactOutputSingleParams> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const { zeroForOnes } = await resolveSwapPath(
    params.publicClient,
    params.tokenIn,
    params.tokenOut,
    [params.pool],
    params.extensionData ? [params.extensionData] : undefined,
  );
  const zeroForOne = zeroForOnes[0]!;
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(zeroForOne);

  const { amountIn } = await quoteLiveExactOutSingle({
    publicClient: params.publicClient,
    pool: params.pool,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    recipient: params.recipient,
    sender: params.sender,
    amountOut: params.amountOut,
    priceLimitX64,
    extensionData: params.extensionData,
    quoterAddress: params.quoterAddress,
  });

  const amountInMaximum = ceilDiv(amountIn * (BPS_BASE + slippageBps), BPS_BASE);

  return {
    pool: params.pool,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    zeroForOne,
    amountOut: params.amountOut,
    amountInMaximum,
    recipient: params.recipient,
    deadline: params.deadline,
    priceLimitX64,
    extensionData: params.extensionData,
  };
}

/**
 * Build multihop exact-input params: resolves path, quotes output, applies slippage.
 *
 * @example
 * ```ts
 * const pathParams = await buildExactInputParams({
 *   publicClient,
 *   tokenIn: tokenA,
 *   tokenOut: tokenC,
 *   pools: [poolAB, poolBC],
 *   recipient: account,
 *   amountIn: parseUnits("1", 18),
 *   slippagePercent: 0.5,
 *   deadline,
 *   quoterAddress: addresses.quoter,
 * });
 * await walletClient.sendTransaction({
 *   to: addresses.simpleRouter,
 *   data: encodeExactInputCalldata(pathParams),
 *   account,
 * });
 * ```
 */
export async function buildExactInputParams(
  params: BuildExactInputParams,
): Promise<ExactInputParams> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const { tokens, extensionDatas, zeroForOneBitMap } = await resolveSwapPath(
    params.publicClient,
    params.tokenIn,
    params.tokenOut,
    params.pools,
    params.extensionDatas,
  );

  const { amountOut } = await quoteLiveExactIn({
    publicClient: params.publicClient,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    pools: params.pools,
    extensionDatas: params.extensionDatas,
    recipient: params.recipient,
    sender: params.sender,
    amountIn: params.amountIn,
    quoterAddress: params.quoterAddress,
  });

  const amountOutMinimum = (amountOut * (BPS_BASE - slippageBps)) / BPS_BASE;

  return {
    tokens,
    pools: [...params.pools],
    extensionDatas,
    zeroForOneBitMap,
    amountIn: params.amountIn,
    amountOutMinimum,
    recipient: params.recipient,
    deadline: params.deadline,
  };
}

/** Build multihop exact-output params with live quote and slippage on `amountInMaximum`. */
export async function buildExactOutputParams(
  params: BuildExactOutputParams,
): Promise<ExactOutputParams> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const { tokens, extensionDatas, zeroForOneBitMap } = await resolveSwapPath(
    params.publicClient,
    params.tokenIn,
    params.tokenOut,
    params.pools,
    params.extensionDatas,
  );

  const { amountIn } = await quoteLiveExactOut({
    publicClient: params.publicClient,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    pools: params.pools,
    extensionDatas: params.extensionDatas,
    recipient: params.recipient,
    sender: params.sender,
    amountOut: params.amountOut,
    quoterAddress: params.quoterAddress,
  });

  const amountInMaximum = ceilDiv(amountIn * (BPS_BASE + slippageBps), BPS_BASE);

  return {
    tokens,
    pools: [...params.pools],
    extensionDatas,
    zeroForOneBitMap,
    amountOut: params.amountOut,
    amountInMaximum,
    recipient: params.recipient,
    deadline: params.deadline,
  };
}
