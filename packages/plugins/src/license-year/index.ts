// Import Third-party Dependencies
import { definePlugin } from "@rezzou/sdk";

// Import Internal Dependencies
import { licenseYearOperation } from "./licenseYear.ts";

export const licenseYearPlugin = definePlugin({
  id: "license-year",
  name: "License Year",
  version: "0.1.0",
  operations: [licenseYearOperation]
});
