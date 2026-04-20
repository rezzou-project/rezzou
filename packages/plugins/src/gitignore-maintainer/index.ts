// Import Third-party Dependencies
import { definePlugin } from "@rezzou/sdk";

// Import Internal Dependencies
import { gitignoreMaintainerOperation } from "./gitignoreMaintainer.ts";

export const gitignoreMaintainerPlugin = definePlugin({
  id: "gitignore-maintainer",
  name: "Gitignore Maintainer",
  version: "0.1.0",
  operations: [gitignoreMaintainerOperation]
});
