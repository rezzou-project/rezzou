// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { createAdapter } from "../adapter.ts";

// CONSTANTS
const kUsage = `Usage: rezzou repos <provider> <namespace>

Providers:
  github   List GitHub repositories in a namespace
  gitlab   List GitLab projects in a group or namespace

Options:
  -h, --help   Show this help message`;

export async function reposCommand(args: string[]): Promise<void> {
  const { positionals, values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true,
    strict: false
  });

  const [provider, namespace] = positionals;

  if (values.help || !provider || !namespace) {
    console.log(kUsage);

    return;
  }

  const adapter = createAdapter(provider);
  const repos = await adapter.listRepos(namespace);

  for (const repo of repos) {
    console.log(`${repo.fullPath} [${repo.defaultBranch}] — ${repo.url}`);
  }
}
