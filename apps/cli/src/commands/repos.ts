// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import type { ProviderAdapter } from "@rezzou/core";

// Import Internal Dependencies
import { createAdapter } from "../adapter.ts";
import { isTTY, selectProvider, selectNamespace } from "../interactive.ts";

// CONSTANTS
const kUsage = `Usage: rezzou repos [provider] [namespace]

Providers:
  github   List GitHub repositories in a namespace
  gitlab   List GitLab projects in a group or namespace

Options:
  -h, --help   Show this help message`;

export async function reposCommand(
  args: string[],
  adapterFactory: (provider: string) => ProviderAdapter = createAdapter
): Promise<void> {
  const { positionals, values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true,
    strict: false
  });

  if (values.help) {
    console.log(kUsage);

    return;
  }

  let [provider, namespace] = positionals;

  if (!provider) {
    if (!isTTY()) {
      console.log(kUsage);

      return;
    }
    provider = await selectProvider();
  }

  let adapterInstance: ProviderAdapter | null = null;
  function getAdapter() {
    adapterInstance ??= adapterFactory(provider);

    return adapterInstance;
  }

  if (!namespace) {
    if (!isTTY()) {
      console.log(kUsage);

      return;
    }
    namespace = await selectNamespace(getAdapter());
  }

  const repos = await getAdapter().listRepos(namespace);

  for (const repo of repos) {
    console.log(`${repo.fullPath} [${repo.defaultBranch}] — ${repo.url}`);
  }
}
