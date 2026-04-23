export type RezzouErrorCode = "rate-limit" | "permission" | "conflict" | "network" | "not-found" | "unknown";

export class RezzouError extends Error {
  readonly code: RezzouErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: RezzouErrorCode,
    message: string,
    options?: { cause?: unknown; details?: Record<string, unknown>; }
  ) {
    super(message, { cause: options?.cause });
    this.code = code;
    this.details = options?.details;
    this.name = "RezzouError";
  }
}
