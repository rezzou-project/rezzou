// Import Third-party Dependencies
import { RezzouError, type RezzouErrorCode } from "@rezzou/core";

// CONSTANTS
const kStatusToCode: Partial<Record<number, RezzouErrorCode>> = {
  401: "permission",
  403: "permission",
  404: "not-found",
  409: "conflict",
  422: "conflict",
  429: "rate-limit"
};

const kNetworkCodes = new Set(["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"]);

function getStatusCode(error: Error): number | null {
  const raw = error as unknown as Record<string, unknown>;

  // Octokit RequestError exposes .status directly
  if ("status" in error && typeof raw.status === "number") {
    return raw.status;
  }

  // GitBeaker: GitbeakerRequestError has cause.response.status
  const { cause } = raw;
  if (cause !== null && typeof cause === "object") {
    const response = (cause as Record<string, unknown>).response;
    if (response !== null && typeof response === "object") {
      const status = (response as Record<string, unknown>).status;
      if (typeof status === "number") {
        return status;
      }
    }
  }

  return null;
}

function isNetworkError(error: Error): boolean {
  const code = (error as unknown as Record<string, unknown>).code;

  return typeof code === "string" && kNetworkCodes.has(code);
}

export function mapProviderError(error: unknown, message: string): RezzouError {
  if (error instanceof RezzouError) {
    return error;
  }

  if (error instanceof Error) {
    const status = getStatusCode(error);
    if (status !== null) {
      const code = kStatusToCode[status] ?? "unknown";

      return new RezzouError(code, message, { cause: error, details: { status } });
    }

    if (isNetworkError(error)) {
      return new RezzouError("network", message, { cause: error });
    }
  }

  return new RezzouError("unknown", message, { cause: error });
}
