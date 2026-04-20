// Import Third-party Dependencies
import { defineOperation, type RepoContext } from "@rezzou/sdk";

// CONSTANTS
const kCurrentYear = String(new Date().getFullYear());
const kCopyrightPattern = /(Copyright\s+(?:\(C\)\s+)?)(\d{4})(?:-(\d{4}))?/i;

export const CURRENT_YEAR = kCurrentYear;

interface LicenseYearInputs extends Record<string, unknown> {
  year?: number;
}

export const licenseYearOperation = defineOperation<LicenseYearInputs>({
  id: "license-year",
  name: "License Year",
  description: "Update the copyright year in the LICENSE file",
  inputs: [
    {
      name: "year",
      label: "Year",
      type: "number" as const,
      default: Number(kCurrentYear)
    }
  ],

  async apply(ctx: RepoContext, inputs: LicenseYearInputs) {
    const year = String(inputs.year ?? kCurrentYear);
    const content = await ctx.readFile("LICENSE");
    if (content === null) {
      return null;
    }

    const match = kCopyrightPattern.exec(content);
    if (match === null) {
      return null;
    }

    const [fullMatch, copyrightPrefix, startYear, endYear] = match;
    const currentEnd = endYear ?? startYear;
    if (currentEnd === year) {
      return null;
    }

    const updated = content.replace(fullMatch, `${copyrightPrefix}${startYear}-${year}`);

    return [
      {
        action: "update",
        path: "LICENSE",
        content: updated
      }
    ];
  },

  branchName: (inputs: LicenseYearInputs) => `rezzou/license-year-${inputs.year ?? kCurrentYear}`,
  commitMessage: (inputs: LicenseYearInputs) => `chore: update license year to ${inputs.year ?? kCurrentYear}`,
  prTitle: (inputs: LicenseYearInputs) => `chore: update license year to ${inputs.year ?? kCurrentYear}`,
  prDescription: (inputs: LicenseYearInputs) => `Automated update of copyright year to ${inputs.year ?? kCurrentYear}, performed by Rezzou.` // eslint-disable-line @stylistic/max-len
});
