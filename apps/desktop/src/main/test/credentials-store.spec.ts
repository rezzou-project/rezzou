// Import Node.js Dependencies
import { describe, it, mock, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

// CONSTANTS
const kTmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "rezzou-creds-test-"));
const kRezzouDir = path.join(kTmpHome, ".rezzou");
const kCredentialsFile = path.join(kRezzouDir, "credentials.json");
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

mock.module("node:os", {
  namedExports: {
    homedir: () => kTmpHome
  }
});

const { saveCredentials, loadSavedCredentials } = await import("../credentials-store.ts");

after(() => {
  fs.rmSync(kTmpHome, { recursive: true, force: true });
});

describe("credentials-store", () => {
  describe("saveCredentials", () => {
    beforeEach(() => {
      mockState.encryptionAvailable = true;
      mockIsEncryptionAvailable.mock.resetCalls();
      mockEncryptString.mock.resetCalls();
      fs.rmSync(kRezzouDir, { recursive: true, force: true });
    });

    it("should throw when encryption is not available", () => {
      mockState.encryptionAvailable = false;

      assert.throws(
        () => saveCredentials(kDecryptedToken, "github"),
        { message: /encryption is not available/i }
      );
      assert.equal(mockEncryptString.mock.callCount(), 0);
    });

    it("should write encrypted credentials to disk", () => {
      saveCredentials(kDecryptedToken, "github");

      assert.ok(fs.existsSync(kCredentialsFile));
      const content = JSON.parse(fs.readFileSync(kCredentialsFile, "utf-8")) as Record<string, string>;
      assert.equal(content.github, kEncryptedBuffer.toString("base64"));
    });

    it("should preserve existing credentials when adding a new provider", () => {
      saveCredentials(kDecryptedToken, "github");
      saveCredentials(kDecryptedToken, "gitlab");

      const content = JSON.parse(fs.readFileSync(kCredentialsFile, "utf-8")) as Record<string, string>;
      assert.ok(typeof content.github === "string");
      assert.ok(typeof content.gitlab === "string");
    });
  });

  describe("loadSavedCredentials", () => {
    beforeEach(() => {
      mockState.encryptionAvailable = true;
      mockState.decryptShouldThrow = false;
      mockDecryptString.mock.resetCalls();
      fs.rmSync(kRezzouDir, { recursive: true, force: true });
    });

    it("should return an empty array when no credentials file exists", () => {
      const result = loadSavedCredentials();

      assert.deepEqual(result, []);
    });

    it("should return saved credentials for known providers", () => {
      fs.mkdirSync(kRezzouDir, { recursive: true });
      fs.writeFileSync(kCredentialsFile, JSON.stringify({
        github: kEncryptedBuffer.toString("base64")
      }));

      const result = loadSavedCredentials();

      assert.equal(result.length, 1);
      assert.equal(result[0].provider, "github");
      assert.equal(result[0].token, kDecryptedToken);
    });

    it("should skip a provider whose decryption fails", () => {
      mockState.decryptShouldThrow = true;
      fs.mkdirSync(kRezzouDir, { recursive: true });
      fs.writeFileSync(kCredentialsFile, JSON.stringify({
        github: kEncryptedBuffer.toString("base64")
      }));

      const result = loadSavedCredentials();

      assert.deepEqual(result, []);
    });

    it("should return an empty array when the credentials file contains invalid JSON", () => {
      fs.mkdirSync(kRezzouDir, { recursive: true });
      fs.writeFileSync(kCredentialsFile, "not-json");

      const result = loadSavedCredentials();

      assert.deepEqual(result, []);
    });
  });
});
