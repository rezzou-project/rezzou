// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { checkSensitivePath, checkSensitiveContent } from "../utils/sensitiveFile.ts";

describe("UT checkSensitivePath", () => {
  it("should flag .env", () => {
    assert.ok(checkSensitivePath(".env") !== null);
  });

  it("should flag .env.local", () => {
    assert.ok(checkSensitivePath(".env.local") !== null);
  });

  it("should flag .env.production", () => {
    assert.ok(checkSensitivePath("config/.env.production") !== null);
  });

  it("should flag .pem files", () => {
    assert.ok(checkSensitivePath("certs/server.pem") !== null);
  });

  it("should flag .key files", () => {
    assert.ok(checkSensitivePath("private.key") !== null);
  });

  it("should flag id_rsa", () => {
    assert.ok(checkSensitivePath("id_rsa") !== null);
  });

  it("should flag id_ed25519", () => {
    assert.ok(checkSensitivePath("id_ed25519") !== null);
  });

  it("should flag files with 'secret' in the name", () => {
    assert.ok(checkSensitivePath("my-secret-config.json") !== null);
  });

  it("should return null for safe files", () => {
    assert.equal(checkSensitivePath("src/index.ts"), null);
    assert.equal(checkSensitivePath("README.md"), null);
    assert.equal(checkSensitivePath(".github/CODEOWNERS"), null);
    assert.equal(checkSensitivePath("package.json"), null);
  });
});

describe("UT checkSensitiveContent", () => {
  it("should flag content with API_KEY=", () => {
    assert.ok(checkSensitiveContent("API_KEY=abc123") !== null);
  });

  it("should flag content with SECRET=", () => {
    assert.ok(checkSensitiveContent("DATABASE_SECRET=hunter2") !== null);
  });

  it("should flag content with a PEM private key header", () => {
    assert.ok(checkSensitiveContent("-----BEGIN RSA PRIVATE KEY-----") !== null);
  });

  it("should flag content with OPENSSH private key header", () => {
    assert.ok(checkSensitiveContent("-----BEGIN OPENSSH PRIVATE KEY-----") !== null);
  });

  it("should return null for safe content", () => {
    assert.equal(checkSensitiveContent("# My Config\nfoo=bar\nbaz=qux"), null);
    assert.equal(checkSensitiveContent("export default {}"), null);
  });
});
