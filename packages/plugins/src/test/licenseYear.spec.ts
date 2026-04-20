// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RepoContext, Repo } from "@rezzou/sdk";

// Import Internal Dependencies
import { licenseYearOperation, CURRENT_YEAR } from "../license-year/licenseYear.ts";

// CONSTANTS
const kRepo: Repo = {
  id: "1",
  name: "my-repo",
  fullPath: "ns/my-repo",
  defaultBranch: "main",
  url: "https://example.com/ns/my-repo"
};

function makeCtx(content: string | null): RepoContext {
  return {
    repo: kRepo,
    provider: "gitlab",
    readFile: async() => content,
    listFiles: async() => [],
    exists: async() => content !== null
  };
}

describe("UT CURRENT_YEAR", () => {
  it("should equal the current calendar year", () => {
    assert.equal(CURRENT_YEAR, String(new Date().getFullYear()));
  });
});

describe("UT licenseYearOperation", () => {
  it("should have 'license-year' as id", () => {
    assert.equal(licenseYearOperation.id, "license-year");
  });

  it("should include current year in branchName", () => {
    assert.equal(licenseYearOperation.branchName({}), `rezzou/license-year-${CURRENT_YEAR}`);
  });

  it("should include current year in commitMessage", () => {
    assert.equal(licenseYearOperation.commitMessage({}), `chore: update license year to ${CURRENT_YEAR}`);
  });

  it("should include current year in prTitle", () => {
    assert.equal(licenseYearOperation.prTitle({}), `chore: update license year to ${CURRENT_YEAR}`);
  });

  it("should include current year in prDescription", () => {
    assert.match(licenseYearOperation.prDescription({}), new RegExp(CURRENT_YEAR));
  });

  it("should use provided year in branchName", () => {
    assert.equal(licenseYearOperation.branchName({ year: 2030 }), "rezzou/license-year-2030");
  });

  describe("apply", () => {
    it("should return null when file does not exist", async() => {
      const result = await licenseYearOperation.apply(makeCtx(null), {});

      assert.equal(result, null);
    });

    it("should return null when content has no copyright pattern", async() => {
      const result = await licenseYearOperation.apply(makeCtx("MIT License\nPermission is hereby granted"), {});

      assert.equal(result, null);
    });

    it("should return null when single year is already current year", async() => {
      const result = await licenseYearOperation.apply(makeCtx(`Copyright ${CURRENT_YEAR}`), {});

      assert.equal(result, null);
    });

    it("should return null when range end year is already current year", async() => {
      const result = await licenseYearOperation.apply(makeCtx(`Copyright 2020-${CURRENT_YEAR}`), {});

      assert.equal(result, null);
    });

    it("should update single year to range ending with current year", async() => {
      const result = await licenseYearOperation.apply(makeCtx("Copyright 2020\nSome license text"), {});

      assert.ok(result !== null);
      assert.equal(result[0].content, `Copyright 2020-${CURRENT_YEAR}\nSome license text`);
      assert.equal(result[0].action, "update");
      assert.equal(result[0].path, "LICENSE");
    });

    it("should update outdated range end year to current year", async() => {
      const result = await licenseYearOperation.apply(makeCtx("Copyright 2020-2024\nSome license text"), {});

      assert.ok(result !== null);
      assert.equal(result[0].content, `Copyright 2020-${CURRENT_YEAR}\nSome license text`);
    });

    it("should handle Copyright (C) prefix", async() => {
      const result = await licenseYearOperation.apply(makeCtx("Copyright (C) 2020"), {});

      assert.ok(result !== null);
      assert.equal(result[0].content, `Copyright (C) 2020-${CURRENT_YEAR}`);
    });

    it("should handle Copyright (c) lowercase prefix", async() => {
      const result = await licenseYearOperation.apply(makeCtx("Copyright (c) 2020-2024"), {});

      assert.ok(result !== null);
      assert.equal(result[0].content, `Copyright (c) 2020-${CURRENT_YEAR}`);
    });

    it("should handle case insensitive copyright keyword", async() => {
      const result = await licenseYearOperation.apply(makeCtx("copyright 2020"), {});

      assert.ok(result !== null);
      assert.equal(result[0].content, `copyright 2020-${CURRENT_YEAR}`);
    });

    it("should only update the copyright line when content has multiple lines", async() => {
      const content = "MIT License\n\nCopyright 2020 Acme Corp\n\nPermission is hereby granted";
      const result = await licenseYearOperation.apply(makeCtx(content), {});

      assert.ok(result !== null);
      assert.equal(result[0].content, `MIT License\n\nCopyright 2020-${CURRENT_YEAR} Acme Corp\n\nPermission is hereby granted`);
    });

    it("should use provided year input instead of current year", async() => {
      const result = await licenseYearOperation.apply(makeCtx("Copyright 2020\nSome text"), { year: 2030 });

      assert.ok(result !== null);
      assert.equal(result[0].content, "Copyright 2020-2030\nSome text");
    });
  });
});
