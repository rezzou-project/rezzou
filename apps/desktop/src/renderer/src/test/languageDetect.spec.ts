// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { detectLanguage } from "../utils/languageDetect.ts";

describe("UT detectLanguage", () => {
  it("should detect .ts as TypeScript", () => {
    const result = detectLanguage("src/index.ts");

    assert.ok(result !== null);
    assert.equal(result.language.name, "typescript");
  });

  it("should detect .js as JavaScript", () => {
    const result = detectLanguage("index.js");

    assert.ok(result !== null);
    assert.equal(result.language.name, "javascript");
  });

  it("should detect .tsx as TypeScript", () => {
    const result = detectLanguage("App.tsx");

    assert.ok(result !== null);
    assert.equal(result.language.name, "typescript");
  });

  it("should detect .json as JSON", () => {
    const result = detectLanguage("package.json");

    assert.ok(result !== null);
    assert.equal(result.language.name, "json");
  });

  it("should detect .md as Markdown", () => {
    const result = detectLanguage("README.md");

    assert.ok(result !== null);
    assert.equal(result.language.name, "markdown");
  });

  it("should detect .css as CSS", () => {
    const result = detectLanguage("styles.css");

    assert.ok(result !== null);
    assert.equal(result.language.name, "css");
  });

  it("should detect .html as HTML", () => {
    const result = detectLanguage("index.html");

    assert.ok(result !== null);
    assert.equal(result.language.name, "html");
  });

  it("should return null for unknown extensions", () => {
    assert.equal(detectLanguage("Makefile"), null);
    assert.equal(detectLanguage("data.csv"), null);
    assert.equal(detectLanguage(".gitignore"), null);
  });

  it("should be case-insensitive for extensions", () => {
    const result = detectLanguage("Config.JSON");

    assert.ok(result !== null);
    assert.equal(result.language.name, "json");
  });
});
