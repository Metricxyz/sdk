import { decodeErrorResult, BaseError, ContractFunctionRevertedError, Abi } from "viem";

/**
 * Try to decode a contract error from a viem error object.
 * Returns a human-readable error string with the error name and arguments.
 *
 * @param error - The error object from a failed contract call
 * @param abi - The contract ABI to use for decoding
 * @returns A formatted error string
 */
export function tryDecodeError(error: any, abi: readonly unknown[]): string {
  try {
    // Try to extract revert data from the error
    if (error instanceof BaseError) {
      const revertError = error.walk((err) => err instanceof ContractFunctionRevertedError);
      if (revertError instanceof ContractFunctionRevertedError) {
        const errorName = revertError.data?.errorName ?? "Unknown error";
        const args = revertError.data?.args;
        if (args && args.length > 0) {
          return `${errorName}(${args.map((a) => String(a)).join(", ")})`;
        }
        return errorName;
      }
    }

    // Try to find raw revert data in various places
    const rawData = extractRawErrorData(error);

    // Try to decode from raw data if available
    if (rawData) {
      try {
        const decoded = decodeErrorResult({
          abi: abi as Abi,
          data: rawData,
        });
        if (decoded.args && decoded.args.length > 0) {
          return `${decoded.errorName}(${decoded.args.map((a) => String(a)).join(", ")})`;
        }
        return decoded.errorName;
      } catch {
        // Decoding failed, return raw data for debugging
        return `Unknown error (raw data: ${rawData})`;
      }
    }

    // Build detailed error message
    const details: string[] = [];

    if (error?.shortMessage) {
      details.push(error.shortMessage);
    } else if (error?.message) {
      details.push(error.message);
    }

    // Check for cause chain
    if (error?.cause) {
      const causeMsg = extractCauseMessage(error.cause);
      if (causeMsg) {
        details.push(`Cause: ${causeMsg}`);
      }
    }

    // Check for metaMessages (viem specific)
    if (error?.metaMessages && Array.isArray(error.metaMessages)) {
      details.push(...error.metaMessages);
    }

    return details.length > 0 ? details.join("\n") : String(error);
  } catch {
    return error?.shortMessage || error?.message || String(error);
  }
}

/**
 * Log error with full details for debugging
 */
export function logErrorDetails(error: any, abi: readonly unknown[]): void {
  console.error("\n❌ Transaction failed!");
  console.error("-".repeat(50));

  // Decoded error
  const decoded = tryDecodeError(error, abi);
  console.error(`Decoded: ${decoded}`);

  // Raw data if available
  const rawData = extractRawErrorData(error);
  if (rawData) {
    console.error(`Raw data: ${rawData}`);
  }

  // Short message
  if (error?.shortMessage) {
    console.error(`Message: ${error.shortMessage}`);
  }

  // Cause chain
  if (error?.cause) {
    console.error(`Cause: ${extractCauseMessage(error.cause) || "unknown"}`);
  }

  // Meta messages
  if (error?.metaMessages && Array.isArray(error.metaMessages)) {
    console.error("Details:");
    for (const msg of error.metaMessages) {
      console.error(`  ${msg}`);
    }
  }

  console.error("\nRaw Error Object:");
  console.dir(error, { depth: null, colors: true });

  console.error("-".repeat(50));
}

/**
 * Extract raw error data from various error structures
 */
function extractRawErrorData(error: any): `0x${string}` | undefined {
  // Direct data property
  if (error?.data && typeof error.data === "string" && error.data.startsWith("0x")) {
    return error.data as `0x${string}`;
  }

  // Nested in cause
  if (
    error?.cause?.data &&
    typeof error.cause.data === "string" &&
    error.cause.data.startsWith("0x")
  ) {
    return error.cause.data as `0x${string}`;
  }

  // Nested in error.error (some RPC responses)
  if (
    error?.error?.data &&
    typeof error.error.data === "string" &&
    error.error.data.startsWith("0x")
  ) {
    return error.error.data as `0x${string}`;
  }

  // Walk BaseError for data
  if (error instanceof BaseError) {
    const errorWithData = error.walk((err: any) => err?.data !== undefined);
    if (errorWithData && (errorWithData as any).data) {
      const data = (errorWithData as any).data;
      if (typeof data === "string" && data.startsWith("0x")) {
        return data as `0x${string}`;
      }
    }
  }

  return undefined;
}

/**
 * Extract message from error cause chain
 */
function extractCauseMessage(cause: any): string | undefined {
  if (!cause) return undefined;

  if (cause.shortMessage) return cause.shortMessage;
  if (cause.message) return cause.message;
  if (cause.cause) return extractCauseMessage(cause.cause);

  return undefined;
}
