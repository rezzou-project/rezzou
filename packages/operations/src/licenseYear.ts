// Import Third-party Dependencies
import type { Operation } from "@rezzou/core";

// CONSTANTS
const kCurrentYear = String(new Date().getFullYear());
const kCopyrightPattern = /(Copyright\s+(?:\(C\)\s+)?)(\d{4})(?:-(\d{4}))?/i;

export const CURRENT_YEAR = kCurrentYear;

function applyLicenseYear(content: string): string | null {
  const match = kCopyrightPattern.exec(content);
  if (match === null) {
    return null;
  }

  const [fullMatch, copyrightPrefix, startYear, endYear] = match;
  const currentEnd = endYear ?? startYear;

  if (currentEnd === kCurrentYear) {
    return null;
  }

  return content.replace(fullMatch, `${copyrightPrefix}${startYear}-${kCurrentYear}`);
}

export const licenseYearOperation = {
  name: "License Year",
  description: "Update the copyright year in the LICENSE file",
  filePath: "LICENSE",
  branchName: `rezzou/license-year-${kCurrentYear}`,
  commitMessage: `chore: update license year to ${kCurrentYear}`,
  prTitle: `chore: update license year to ${kCurrentYear}`,
  prDescription: `Automated update of copyright year to ${kCurrentYear}, performed by Rezzou.`,
  reviewers: [],
  apply: applyLicenseYear
} satisfies Operation;
