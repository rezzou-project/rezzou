// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import type { ProviderAdapter } from "@rezzou/core";

// Import Internal Dependencies
import { createAdapter } from "../adapter.ts";

// CONSTANTS
const kUsage = `Usage: rezzou namespaces <provider>

Providers:
  github   List GitHub organizations and user namespaces
  gitlab   List GitLab groups and user namespace

Options:
  -h, --help   Show this help message`;

export async function namespacesCommand(
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

  const [provider] = positionals;

  if (values.help || !provider) {
    console.log(kUsage);

    return;
  }

  const adapter = adapterFactory(provider);
  const namespaces = await adapter.listNamespaces();

  for (const namespace of namespaces) {
    console.log(`${namespace.displayName} (${namespace.type}) — ${namespace.id}`);
  }
}
