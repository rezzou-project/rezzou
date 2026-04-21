// Import Third-party Dependencies
import { definePlugin } from "@rezzou/sdk";

// Import Internal Dependencies
import { replacePatternOperation } from "./replacePattern.ts";

export const replacePatternPlugin = definePlugin({
  id: "replace-pattern",
  name: "Replace Pattern",
  version: "0.1.0",
  operations: [replacePatternOperation]
});
