// Import Node.js Dependencies
import { describe, it, mock, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

// CONSTANTS
const kTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rezzou-creds-test-"));
const kEncryptedBuffer = Buffer.from("encrypted-token");
const kDecryptedToken = "my-secret-token";

const mockState = {
  encryptionAvailable: true,
  decryptShouldThrow: false
};

const mockIsEncryptionAvailable = mock.fn(() => mockState.encryptionAvailable);
const mockEncryptString = mock.fn((_token: string) => kEncryptedBuffer);
const mockDecryptString = mock.fn((_buf: Buffer) => {
  if (mockState.decryptShouldThrow) {
    throw new Error("decrypt error");
  }

  return kDecryptedToken;
});

mock.module("electron", {
  namedExports: {
    safeStorage: {
      isEncryptionAvailable: mockIsEncryptionAvailable,
      encryptString: mockEncryptString,
      decryptString: mockDecryptString
    }
  }
});

const { saveCredentials, loadSavedCredentials } = await import("../credentials-store.ts");

after(() => {
  fs.rmSync(kTmpDir, { recursive: true, force: true });
});

describe("credentials-store", () => {
  describe("saveCredentials", () => {
    beforeEach(() => {
      mockState.encryptionAvailable = true;
      mockIsEncryptionAvailable.mock.resetCalls();
      mockEncryptString.mock.resetCalls();
      fs.rmSync(kTmpDir, { recursive: true, force: true });
      fs.mkdirSync(kTmpDir, { recursive: true });
    });

    it("should throw when encryption is not available", () => {
      mockState.encryptionAvailable = false;

      assert.throws(
        () => saveCredentials(kTmpDir, kDecryptedToken, "github"),
        { message: /encryption is not available/i }
      );
      assert.equal(mockEncryptString.mock.callCount(), 0);
    });

    it("should write encrypted credentials to disk", () => {
      saveCredentials(kTmpDir, kDecryptedToken, "github");

      const credPath = path.join(kTmpDir, "credentials.json");
      assert.ok(fs.existsSync(credPath));
      const content = JSON.parse(fs.readFileSync(credPath, "utf-8")) as Record<string, string>;
      assert.equal(content.github, kEncryptedBuffer.toString("base64"));
    });

    it("should preserve existing credentials when adding a new provider", () => {
      saveCredentials(kTmpDir, kDecryptedToken, "github");
      saveCredentials(kTmpDir, kDecryptedToken, "gitlab");

      const credPath = path.join(kTmpDir, "credentials.json");
      const content = JSON.parse(fs.readFileSync(credPath, "utf-8")) as Record<string, string>;
      assert.ok(typeof content.github === "string");
      assert.ok(typeof content.gitlab === "string");
    });
  });

  describe("loadSavedCredentials", () => {
    beforeEach(() => {
      mockState.encryptionAvailable = true;
      mockState.decryptShouldThrow = false;
      mockDecryptString.mock.resetCalls();
      fs.rmSync(kTmpDir, { recursive: true, force: true });
      fs.mkdirSync(kTmpDir, { recursive: true });
    });

    it("should return an empty array when no credentials file exists", () => {
      const result = loadSavedCredentials(kTmpDir);

      assert.deepEqual(result, []);
    });

    it("should return saved credentials for known providers", () => {
      const credPath = path.join(kTmpDir, "credentials.json");
      fs.writeFileSync(credPath, JSON.stringify({
        github: kEncryptedBuffer.toString("base64")
      }));

      const result = loadSavedCredentials(kTmpDir);

      assert.equal(result.length, 1);
      assert.equal(result[0].provider, "github");
      assert.equal(result[0].token, kDecryptedToken);
    });

    it("should skip a provider whose decryption fails", () => {
      mockState.decryptShouldThrow = true;
      const credPath = path.join(kTmpDir, "credentials.json");
      fs.writeFileSync(credPath, JSON.stringify({
        github: kEncryptedBuffer.toString("base64")
      }));

      const result = loadSavedCredentials(kTmpDir);

      assert.deepEqual(result, []);
    });

    it("should return an empty array when the credentials file contains invalid JSON", () => {
      const credPath = path.join(kTmpDir, "credentials.json");
      fs.writeFileSync(credPath, "not-json");

      const result = loadSavedCredentials(kTmpDir);

      assert.deepEqual(result, []);
    });
  });
});
