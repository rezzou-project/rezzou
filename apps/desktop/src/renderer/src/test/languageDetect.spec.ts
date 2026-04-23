// Import Node.js Dependencies
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

await mock.module("@codemirror/lang-javascript", {
  namedExports: {
    javascript: (opts?: unknown) => {
      return { name: "javascript", opts };
    }
  }
});
await mock.module("@codemirror/lang-json", {
  namedExports: {
    json: () => {
      return { name: "json" };
    }
  }
});
await mock.module("@codemirror/lang-markdown", {
  namedExports: {
    markdown: () => {
      return { name: "markdown" };
    }
  }
});
await mock.module("@codemirror/lang-css", {
  namedExports: {
    css: () => {
      return { name: "css" };
    }
  }
});
await mock.module("@codemirror/lang-html", {
  namedExports: {
    html: () => {
      return { name: "html" };
    }
  }
});
await mock.module("@codemirror/language", {
  namedExports: {
    LanguageSupport: class {}
  }
});

const { detectLanguage } = await import("../utils/languageDetect.ts");

describe("UT detectLanguage", () => {
  it("should detect .ts as JavaScript (typescript)", () => {
    const result = detectLanguage("src/index.ts") as { name: string; opts: unknown; };
    assert.equal(result.name, "javascript");
  });

  it("should detect .js as JavaScript", () => {
    const result = detectLanguage("index.js") as { name: string; };
    assert.equal(result.name, "javascript");
  });

  it("should detect .tsx as JavaScript (jsx + typescript)", () => {
    const result = detectLanguage("App.tsx") as { name: string; opts: { jsx: boolean; typescript: boolean; }; };
    assert.equal(result.name, "javascript");
    assert.equal(result.opts.jsx, true);
    assert.equal(result.opts.typescript, true);
  });

  it("should detect .json as JSON", () => {
    const result = detectLanguage("package.json") as { name: string; };
    assert.equal(result.name, "json");
  });

  it("should detect .md as Markdown", () => {
    const result = detectLanguage("README.md") as { name: string; };
    assert.equal(result.name, "markdown");
  });

  it("should detect .css as CSS", () => {
    const result = detectLanguage("styles.css") as { name: string; };
    assert.equal(result.name, "css");
  });

  it("should detect .html as HTML", () => {
    const result = detectLanguage("index.html") as { name: string; };
    assert.equal(result.name, "html");
  });

  it("should return null for unknown extensions", () => {
    assert.equal(detectLanguage("Makefile"), null);
    assert.equal(detectLanguage("data.csv"), null);
    assert.equal(detectLanguage(".gitignore"), null);
  });

  it("should be case-insensitive for extensions", () => {
    const result = detectLanguage("Config.JSON") as { name: string; };
    assert.equal(result.name, "json");
  });
});
