// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import { scanRepos, type ProviderAdapter, type Repo, type RepoDiff, type Operation } from "@rezzou/core";

// Import Internal Dependencies
import { createAdapter } from "../adapter.ts";
import { loadPluginOperations } from "../plugin-loader.ts";
import { readPluginPaths, scanPluginsDir } from "../plugin-store.ts";

// CONSTANTS
const kUsage = `Usage: rezzou scan <provider> <namespace> --operation <op-id> [options]

Options:
  -o, --operation <id>       Operation ID to apply (required)
  -i, --input key=value      Input value for the operation (repeatable)
  -r, --repos repo1,repo2    Comma-separated list of repo full paths to scan (default: all)
  -h, --help                 Show this help message`;

type RunScanFn = (
  adapter: ProviderAdapter,
  repos: Repo[],
  options: { operation: Operation; inputs: Record<string, unknown>; }
) => Promise<RepoDiff[]>;

export interface ScanDeps {
  createAdapter: (provider: string) => ProviderAdapter;
  getPluginPaths: () => string[];
  loadOperations: (paths: string[]) => Promise<Map<string, Operation>>;
  runScan: RunScanFn;
}

const kDefaultDeps: ScanDeps = {
  createAdapter,
  getPluginPaths: () => [...new Set([...readPluginPaths(), ...scanPluginsDir()])],
  loadOperations: loadPluginOperations,
  runScan: (adapter, repos, options) => scanRepos(adapter, repos, options)
};

function parseInputs(rawInputs: string[]): Record<string, unknown> {
  return Object.fromEntries(
    rawInputs.flatMap((kv) => {
      const eqIdx = kv.indexOf("=");
      if (eqIdx === -1) {
        return [];
      }

      return [[kv.slice(0, eqIdx), kv.slice(eqIdx + 1)]];
    })
  );
}

function printRepoDiff(diff: RepoDiff): void {
  const patchWord = diff.patches.length === 1 ? "patch" : "patches";
  console.log(`\n${diff.repo.fullPath}  (${diff.patches.length} ${patchWord})`);
  for (const patch of diff.patches) {
    console.log(`  ${patch.action.padEnd(8)}${patch.path}`);
  }
}

export async function scanCommand(args: string[], deps: ScanDeps = kDefaultDeps): Promise<void> {
  const { positionals, values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      operation: { type: "string", short: "o" },
      input: { type: "string", short: "i", multiple: true },
      repos: { type: "string", short: "r" }
    },
    allowPositionals: true,
    strict: false
  });

  const [provider, namespace] = positionals;

  if (values.help || !provider || !namespace) {
    console.log(kUsage);

    return;
  }

  if (!values.operation) {
    console.error("Missing required option: --operation <op-id>\n");
    console.log(kUsage);

    return;
  }

  const pluginPaths = deps.getPluginPaths();
  const operations = await deps.loadOperations(pluginPaths);
  const operation = operations.get(values.operation);

  if (!operation) {
    const available = [...operations.keys()].join(", ") || "(none)";
    throw new Error(`Operation not found: "${values.operation}". Available: ${available}`);
  }

  const inputs = parseInputs(values.input ?? []);
  const adapter = deps.createAdapter(provider);

  let repos = await adapter.listRepos(namespace);

  if (values.repos) {
    const filterSet = new Set(values.repos.split(",").map((repo) => repo.trim()));
    repos = repos.filter((repo) => filterSet.has(repo.fullPath));
  }

  console.log(`\nScanning ${repos.length} repos for operation "${values.operation}"...`);

  const diffs = await deps.runScan(adapter, repos, { operation, inputs });

  for (const diff of diffs) {
    printRepoDiff(diff);
  }

  const changedCount = diffs.length;
  const unchangedCount = repos.length - changedCount;

  if (unchangedCount > 0) {
    const repoWord = unchangedCount === 1 ? "repo" : "repos";
    console.log(`\nNo changes in ${unchangedCount} ${repoWord}.`);
  }

  console.log(`\nSummary: ${changedCount} of ${repos.length} repos would be affected`);
}
