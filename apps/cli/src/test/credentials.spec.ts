// Import Node.js Dependencies
import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

// CONSTANTS
const kTmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "rezzou-cli-test-"));
const kRezzouDir = path.join(kTmpHome, ".rezzou");
const kCredentialsFile = path.join(kRezzouDir, "cli-credentials.json");

process.env.HOME = kTmpHome;

const { saveToken, loadToken } = await import("../credentials.ts");

after(() => {
  fs.rmSync(kTmpHome, { recursive: true, force: true });
});

describe("loadToken", () => {
  beforeEach(() => {
    fs.rmSync(kRezzouDir, { recursive: true, force: true });
  });

  it("should return null when the credentials file does not exist", () => {
    const token = loadToken("github");

    assert.equal(token, null);
  });

  it("should return null when the provider is not present in the credentials file", () => {
    fs.mkdirSync(kRezzouDir, { recursive: true });
    fs.writeFileSync(kCredentialsFile, JSON.stringify({ gitlab: "glpat-abc" }));

    const token = loadToken("github");

    assert.equal(token, null);
  });

  it("should return the token for the given provider", () => {
    fs.mkdirSync(kRezzouDir, { recursive: true });
    fs.writeFileSync(kCredentialsFile, JSON.stringify({ github: "ghp_abc123" }));

    const token = loadToken("github");

    assert.equal(token, "ghp_abc123");
  });

  it("should return null when the credentials file is malformed JSON", () => {
    fs.mkdirSync(kRezzouDir, { recursive: true });
    fs.writeFileSync(kCredentialsFile, "not-valid-json");

    const token = loadToken("github");

    assert.equal(token, null);
  });
});

describe("UT saveToken", () => {
  beforeEach(() => {
    fs.rmSync(kRezzouDir, { recursive: true, force: true });
  });

  it("should create the credentials file with the given token", () => {
    saveToken("github", "ghp_abc123");

    const raw = JSON.parse(fs.readFileSync(kCredentialsFile, "utf-8")) as Record<string, string>;

    assert.equal(raw.github, "ghp_abc123");
  });

  it("should preserve existing tokens when adding a new provider", () => {
    fs.mkdirSync(kRezzouDir, { recursive: true });
    fs.writeFileSync(kCredentialsFile, JSON.stringify({ gitlab: "glpat-abc" }));

    saveToken("github", "ghp_abc123");

    const raw = JSON.parse(fs.readFileSync(kCredentialsFile, "utf-8")) as Record<string, string>;

    assert.equal(raw.github, "ghp_abc123");
    assert.equal(raw.gitlab, "glpat-abc");
  });

  it("should overwrite the token for an existing provider", () => {
    fs.mkdirSync(kRezzouDir, { recursive: true });
    fs.writeFileSync(kCredentialsFile, JSON.stringify({ github: "ghp_old" }));

    saveToken("github", "ghp_new");

    const raw = JSON.parse(fs.readFileSync(kCredentialsFile, "utf-8")) as Record<string, string>;

    assert.equal(raw.github, "ghp_new");
  });

  it("should create the .rezzou directory if it does not exist", () => {
    saveToken("gitlab", "glpat-xyz");

    assert.ok(fs.existsSync(kRezzouDir));
    assert.ok(fs.existsSync(kCredentialsFile));
  });
});
