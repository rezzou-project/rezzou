// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import { confirm } from "@topcli/prompts";
import {
  scanRepos,
  applyRepoDiff,
  type ProviderAdapter,
  type Repo,
  type RepoDiff,
  type Operation,
  type SubmitResult
} from "@rezzou/core";

// Import Internal Dependencies
import { createAdapter } from "../adapter.ts";
import { loadPluginOperations } from "../plugin-loader.ts";
import { readPluginPaths, scanPluginsDir } from "../plugin-store.ts";
import {
  isTTY,
  selectProvider,
  selectNamespace,
  selectOperation,
  multiselectRepos,
  promptOperationInputs
} from "../interactive.ts";

// CONSTANTS
const kUsage = `Usage: rezzou apply [provider] [namespace] [options]

Options:
  -o, --operation <id>       Operation ID to apply
  -i, --input key=value      Input value for the operation (repeatable)
  -r, --repos repo1,repo2    Comma-separated list of repo full paths (default: all)
  -y, --yes                  Skip confirmation prompt
  -f, --force                Reset head branch to base before applying
  -h, --help                 Show this help message`;

type RunScanFn = (
  adapter: ProviderAdapter,
  repos: Repo[],
  options: { operation: Operation; inputs: Record<string, unknown>; }
) => Promise<RepoDiff[]>;

type RunApplyFn = (
  adapter: ProviderAdapter,
  diff: RepoDiff,
  options: { operation: Operation; inputs: Record<string, unknown>; force?: boolean; }
) => Promise<SubmitResult>;

export interface ApplyDeps {
  createAdapter: (provider: string) => ProviderAdapter;
  getPluginPaths: () => string[];
  loadOperations: (paths: string[]) => Promise<Map<string, Operation>>;
  runScan: RunScanFn;
  runApply: RunApplyFn;
  confirmApply: (count: number) => Promise<boolean>;
}

const kDefaultDeps: ApplyDeps = {
  createAdapter,
  getPluginPaths: () => [...new Set([...readPluginPaths(), ...scanPluginsDir()])],
  loadOperations: loadPluginOperations,
  runScan: (adapter, repos, options) => scanRepos(adapter, repos, options),
  runApply: (adapter, diff, options) => applyRepoDiff(adapter, diff, options),
  confirmApply: async(count) => {
    const repoWord = count === 1 ? "repo" : "repos";

    return confirm(`Apply changes to ${count} ${repoWord}?`, { initial: false });
  }
};

function parseInputs(rawInputs: string[]): Record<string, unknown> {
  return Object.fromEntries(
    rawInputs.flatMap((kv) => {
      const equalIndex = kv.indexOf("=");
      if (equalIndex === -1) {
        return [];
      }

      return [[kv.slice(0, equalIndex), kv.slice(equalIndex + 1)]];
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

export async function applyCommand(args: string[], deps: ApplyDeps = kDefaultDeps): Promise<void> {
  const { positionals, values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      operation: { type: "string", short: "o" },
      input: { type: "string", short: "i", multiple: true },
      repos: { type: "string", short: "r" },
      yes: { type: "boolean", short: "y" },
      force: { type: "boolean", short: "f" }
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
    adapterInstance ??= deps.createAdapter(provider);

    return adapterInstance;
  }

  if (!namespace) {
    if (!isTTY()) {
      console.log(kUsage);

      return;
    }
    namespace = await selectNamespace(getAdapter());
  }

  const pluginPaths = deps.getPluginPaths();
  const operations = await deps.loadOperations(pluginPaths);

  let operationId: string | undefined = typeof values.operation === "string" ? values.operation : undefined;

  if (!operationId) {
    if (!isTTY()) {
      console.error("Missing required option: --operation <op-id>\n");
      console.log(kUsage);

      return;
    }
    operationId = await selectOperation(operations);
  }

  const operation = operations.get(operationId);

  if (!operation) {
    const available = [...operations.keys()].join(", ") || "(none)";
    throw new Error(`Operation not found: "${operationId}". Available: ${available}`);
  }

  const rawInputs = (values.input ?? []).filter((val): val is string => typeof val === "string");
  const inputs = await promptOperationInputs(operation, parseInputs(rawInputs));

  let repos: Repo[];
  const rawRepos = typeof values.repos === "string" ? values.repos : undefined;

  if (rawRepos) {
    const allRepos = await getAdapter().listRepos(namespace);
    const filterSet = new Set(rawRepos.split(",").map((repo) => repo.trim()));
    repos = allRepos.filter((repo) => filterSet.has(repo.fullPath));
  }
  else if (isTTY()) {
    repos = await multiselectRepos(getAdapter(), namespace);
  }
  else {
    repos = await getAdapter().listRepos(namespace);
  }

  console.log(`\nScanning ${repos.length} repos for operation "${operationId}"...`);

  const diffs = await deps.runScan(getAdapter(), repos, { operation, inputs });

  for (const diff of diffs) {
    printRepoDiff(diff);
  }

  if (diffs.length === 0) {
    console.log("\nNothing to apply.");

    return;
  }

  const changedCount = diffs.length;
  const unchangedCount = repos.length - changedCount;

  if (unchangedCount > 0) {
    const repoWord = unchangedCount === 1 ? "repo" : "repos";
    console.log(`\nNo changes in ${unchangedCount} ${repoWord}.`);
  }

  console.log(`\n${changedCount} ${changedCount === 1 ? "repo" : "repos"} would be affected.`);

  const skipConfirm = values.yes === true;

  if (!skipConfirm) {
    if (!isTTY()) {
      console.error("Use --yes to confirm application in non-interactive mode.");

      return;
    }
    const confirmed = await deps.confirmApply(changedCount);
    if (!confirmed) {
      console.log("Aborted.");

      return;
    }
  }

  const force = values.force === true;
  let applied = 0;
  let failed = 0;

  for (const diff of diffs) {
    console.log(`[${applied + failed + 1}/${changedCount}] Applying ${diff.repo.fullPath}...`);
    try {
      const result = await deps.runApply(getAdapter(), diff, { operation, inputs, force });
      console.log(`  → ${result.prUrl}`);
      applied++;
    }
    catch (error) {
      console.error(`  Failed: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  if (failed > 0) {
    console.log(`\nDone. ${applied} succeeded, ${failed} failed.`);
  }
  else {
    console.log(`\nDone. ${applied} ${applied === 1 ? "PR" : "PRs"} opened.`);
  }
}
