// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { licenseYearOperation, CURRENT_YEAR } from "../licenseYear.ts";

describe("UT CURRENT_YEAR", () => {
  it("should equal the current calendar year", () => {
    assert.equal(CURRENT_YEAR, String(new Date().getFullYear()));
  });
});

describe("UT licenseYearOperation", () => {
  it("should have LICENSE as filePath", () => {
    assert.equal(licenseYearOperation.filePath, "LICENSE");
  });

  it("should include current year in branchName", () => {
    assert.equal(licenseYearOperation.branchName, `rezzou/license-year-${CURRENT_YEAR}`);
  });

  it("should include current year in commitMessage", () => {
    assert.equal(licenseYearOperation.commitMessage, `chore: update license year to ${CURRENT_YEAR}`);
  });

  it("should include current year in prTitle", () => {
    assert.equal(licenseYearOperation.prTitle, `chore: update license year to ${CURRENT_YEAR}`);
  });

  it("should include current year in prDescription", () => {
    assert.match(licenseYearOperation.prDescription, new RegExp(CURRENT_YEAR));
  });

  describe("apply", () => {
    it("should return null when content has no copyright pattern", () => {
      const result = licenseYearOperation.apply("MIT License\nPermission is hereby granted");

      assert.equal(result, null);
    });

    it("should return null when single year is already current year", () => {
      const result = licenseYearOperation.apply(`Copyright ${CURRENT_YEAR}`);

      assert.equal(result, null);
    });

    it("should return null when range end year is already current year", () => {
      const result = licenseYearOperation.apply(`Copyright 2020-${CURRENT_YEAR}`);

      assert.equal(result, null);
    });

    it("should update single year to range ending with current year", () => {
      const result = licenseYearOperation.apply("Copyright 2020\nSome license text");

      assert.equal(result, `Copyright 2020-${CURRENT_YEAR}\nSome license text`);
    });

    it("should update outdated range end year to current year", () => {
      const result = licenseYearOperation.apply("Copyright 2020-2024\nSome license text");

      assert.equal(result, `Copyright 2020-${CURRENT_YEAR}\nSome license text`);
    });

    it("should handle Copyright (C) prefix", () => {
      const result = licenseYearOperation.apply("Copyright (C) 2020");

      assert.equal(result, `Copyright (C) 2020-${CURRENT_YEAR}`);
    });

    it("should handle Copyright (c) lowercase prefix", () => {
      const result = licenseYearOperation.apply("Copyright (c) 2020-2024");

      assert.equal(result, `Copyright (c) 2020-${CURRENT_YEAR}`);
    });

    it("should handle case insensitive copyright keyword", () => {
      const result = licenseYearOperation.apply("copyright 2020");

      assert.equal(result, `copyright 2020-${CURRENT_YEAR}`);
    });

    it("should only update the copyright line when content has multiple lines", () => {
      const content = "MIT License\n\nCopyright 2020 Acme Corp\n\nPermission is hereby granted";
      const result = licenseYearOperation.apply(content);

      assert.equal(result, `MIT License\n\nCopyright 2020-${CURRENT_YEAR} Acme Corp\n\nPermission is hereby granted`);
    });
  });
});
