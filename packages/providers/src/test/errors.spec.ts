// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { RezzouError } from "@rezzou/core";

// Import Internal Dependencies
import { mapProviderError } from "../errors.ts";

describe("mapProviderError", () => {
  describe("Octokit errors (status on the error itself)", () => {
    it("should map status 429 to rate-limit", () => {
      const error = Object.assign(new Error("Too Many Requests"), { status: 429 });

      const result = mapProviderError(error, "failed");

      assert.ok(result instanceof RezzouError);
      assert.equal(result.code, "rate-limit");
      assert.equal(result.message, "failed");
      assert.deepEqual(result.details, { status: 429 });
    });

    it("should map status 403 to permission", () => {
      const error = Object.assign(new Error("Forbidden"), { status: 403 });

      const result = mapProviderError(error, "failed");

      assert.equal(result.code, "permission");
    });

    it("should map status 401 to permission", () => {
      const error = Object.assign(new Error("Unauthorized"), { status: 401 });

      const result = mapProviderError(error, "failed");

      assert.equal(result.code, "permission");
    });

    it("should map status 404 to not-found", () => {
      const error = Object.assign(new Error("Not Found"), { status: 404 });

      const result = mapProviderError(error, "failed");

      assert.equal(result.code, "not-found");
    });

    it("should map status 409 to conflict", () => {
      const error = Object.assign(new Error("Conflict"), { status: 409 });

      const result = mapProviderError(error, "failed");

      assert.equal(result.code, "conflict");
    });

    it("should map status 422 to conflict", () => {
      const error = Object.assign(new Error("Unprocessable Entity"), { status: 422 });

      const result = mapProviderError(error, "failed");

      assert.equal(result.code, "conflict");
    });

    it("should map unmapped status codes to unknown", () => {
      const error = Object.assign(new Error("Internal Server Error"), { status: 500 });

      const result = mapProviderError(error, "failed");

      assert.equal(result.code, "unknown");
    });
  });

  describe("GitBeaker errors (status on cause.response)", () => {
    it("should map status 429 from cause.response to rate-limit", () => {
      const error = Object.assign(new Error("GitbeakerRequestError"), {
        cause: { response: { status: 429 } }
      });

      const result = mapProviderError(error, "failed");

      assert.equal(result.code, "rate-limit");
      assert.deepEqual(result.details, { status: 429 });
    });

    it("should map status 403 from cause.response to permission", () => {
      const error = Object.assign(new Error("GitbeakerRequestError"), {
        cause: { response: { status: 403 } }
      });

      const result = mapProviderError(error, "failed");

      assert.equal(result.code, "permission");
    });
  });

  describe("network errors", () => {
    it("should map ENOTFOUND to network", () => {
      const error = Object.assign(new Error("getaddrinfo ENOTFOUND api.github.com"), { code: "ENOTFOUND" });

      const result = mapProviderError(error, "failed");

      assert.equal(result.code, "network");
    });

    it("should map ECONNREFUSED to network", () => {
      const error = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });

      const result = mapProviderError(error, "failed");

      assert.equal(result.code, "network");
    });

    it("should map ETIMEDOUT to network", () => {
      const error = Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" });

      const result = mapProviderError(error, "failed");

      assert.equal(result.code, "network");
    });
  });

  describe("passthrough and fallbacks", () => {
    it("should return the same RezzouError unchanged", () => {
      const original = new RezzouError("permission", "already classified");

      const result = mapProviderError(original, "should not override");

      assert.equal(result, original);
    });

    it("should map plain Error without status to unknown", () => {
      const error = new Error("something went wrong");

      const result = mapProviderError(error, "failed");

      assert.equal(result.code, "unknown");
    });

    it("should map non-Error values to unknown", () => {
      const result = mapProviderError("string error", "failed");

      assert.equal(result.code, "unknown");
    });

    it("should preserve the original error as cause", () => {
      const original = new Error("original");

      const result = mapProviderError(original, "wrapped");

      assert.equal(result.cause, original);
    });
  });
});
