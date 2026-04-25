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

process.env.HOME = kTmpHome;

// electron is a CJS module with no named ESM exports — mock it so the module can load.
// The actual safeStorage is injected via IoC in every test call; this stub is never invoked.
mock.module("electron", { namedExports: { safeStorage: null } });

const { saveCredentials, loadSavedCredentials } = await import("../credentials-store.ts");

const kStorageOk = {
  isEncryptionAvailable: () => true,
  encryptString: (_token: string) => kEncryptedBuffer,
  decryptString: (_buf: Buffer) => kDecryptedToken
};

const kStorageUnavailable = {
  isEncryptionAvailable: () => false,
  encryptString: (_token: string) => kEncryptedBuffer,
  decryptString: (_buf: Buffer) => kDecryptedToken
};

after(() => {
  fs.rmSync(kTmpHome, { recursive: true, force: true });
});

describe("credentials-store", () => {
  describe("saveCredentials", () => {
    beforeEach(() => {
      fs.rmSync(kRezzouDir, { recursive: true, force: true });
    });

    it("should throw when encryption is not available", () => {
      assert.throws(
        () => saveCredentials(kDecryptedToken, "github", kStorageUnavailable),
        { message: /encryption is not available/i }
      );
    });

    it("should write encrypted credentials to disk", () => {
      saveCredentials(kDecryptedToken, "github", kStorageOk);

      assert.ok(fs.existsSync(kCredentialsFile));
      const content = JSON.parse(fs.readFileSync(kCredentialsFile, "utf-8")) as Record<string, string>;
      assert.equal(content.github, kEncryptedBuffer.toString("base64"));
    });

    it("should preserve existing credentials when adding a new provider", () => {
      saveCredentials(kDecryptedToken, "github", kStorageOk);
      saveCredentials(kDecryptedToken, "gitlab", kStorageOk);

      const content = JSON.parse(fs.readFileSync(kCredentialsFile, "utf-8")) as Record<string, string>;
      assert.ok(typeof content.github === "string");
      assert.ok(typeof content.gitlab === "string");
    });
  });

  describe("loadSavedCredentials", () => {
    beforeEach(() => {
      fs.rmSync(kRezzouDir, { recursive: true, force: true });
    });

    it("should return an empty array when no credentials file exists", () => {
      const result = loadSavedCredentials(kStorageOk);

      assert.deepEqual(result, []);
    });

    it("should return saved credentials for known providers", () => {
      fs.mkdirSync(kRezzouDir, { recursive: true });
      fs.writeFileSync(kCredentialsFile, JSON.stringify({
        github: kEncryptedBuffer.toString("base64")
      }));

      const result = loadSavedCredentials(kStorageOk);

      assert.equal(result.length, 1);
      assert.equal(result[0].provider, "github");
      assert.equal(result[0].token, kDecryptedToken);
    });

    it("should skip a provider whose decryption fails", () => {
      const storageThrows = {
        isEncryptionAvailable: () => true,
        encryptString: (_token: string) => kEncryptedBuffer,
        decryptString: (_buf: Buffer): string => {
          throw new Error("decrypt error");
        }
      };

      fs.mkdirSync(kRezzouDir, { recursive: true });
      fs.writeFileSync(kCredentialsFile, JSON.stringify({
        github: kEncryptedBuffer.toString("base64")
      }));

      const result = loadSavedCredentials(storageThrows);

      assert.deepEqual(result, []);
    });

    it("should return an empty array when the credentials file contains invalid JSON", () => {
      fs.mkdirSync(kRezzouDir, { recursive: true });
      fs.writeFileSync(kCredentialsFile, "not-json");

      const result = loadSavedCredentials(kStorageOk);

      assert.deepEqual(result, []);
    });
  });
});
