// Import Node.js Dependencies
import * as path from "node:path";
import * as url from "node:url";
import * as cp from "node:child_process";

// Import Third-party Dependencies
import {
  parsePlugin,
  type Plugin,
  type Operation,
  type RepoFilter,
  type RepoContext,
  type Patch,
  type InputField
} from "@rezzou/sdk";

// Import Internal Dependencies
import { registry as operationRegistry } from "./operation-registry.ts";
import { filterRegistry } from "./filter-registry.ts";

interface CallPending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface SerializedOperation {
  id: string;
  name: string;
  description: string;
  inputs?: InputField[];
  branchNameFn: string;
  commitMessageFn: string;
  prTitleFn: string;
  prDescriptionFn: string;
}

interface SerializedPlugin {
  id: string;
  name: string;
  version: string;
  operations: SerializedOperation[];
  filters: Array<{ id: string; name: string; description?: string; }>;
}

interface LoadedPluginEntry {
  operationIds: string[];
  filterIds: string[];
}

const loadedPlugins = new Map<string, LoadedPluginEntry>();

function registerPlugin(plugin: Plugin, filePath: string): void {
  const operationIds: string[] = [];
  const filterIds: string[] = [];

  for (const operation of plugin.operations) {
    operationRegistry.register(operation);
    operationIds.push(operation.id);
  }
  for (const filter of plugin.filters ?? []) {
    filterRegistry.register(filter);
    filterIds.push(filter.id);
  }

  loadedPlugins.set(filePath, { operationIds, filterIds });
}

export function unregisterPluginByPath(filePath: string): void {
  const entry = loadedPlugins.get(filePath);
  if (!entry) {
    return;
  }

  for (const id of entry.operationIds) {
    operationRegistry.unregister(id);
  }
  for (const id of entry.filterIds) {
    filterRegistry.unregister(id);
  }
  loadedPlugins.delete(filePath);
}

async function loadJsPlugin(filePath: string): Promise<Plugin> {
  const fileUrl = url.pathToFileURL(filePath).href;

  let mod: unknown;
  try {
    mod = await import(fileUrl);
  }
  catch (error) {
    throw new Error(`Failed to import plugin from "${filePath}"`, { cause: error });
  }

  const raw: unknown = (mod as Record<string, unknown>).default ?? mod;
  const plugin = parsePlugin(raw);
  registerPlugin(plugin, filePath);

  return plugin;
}

function reconstructFn<TFn>(fnStr: string): TFn {
  // Method shorthand "name(...) {...}" is not a valid expression; prepend `function`.
  const isMethodShorthand = !/^(?:function\b|\(|async\s*\(|async\s+function\b)/.test(fnStr);
  const normalized = isMethodShorthand ? `function ${fnStr}` : fnStr;

  // eslint-disable-next-line no-new-func
  return new Function(`return (${normalized})`)() as unknown as TFn;
}

async function loadTsPlugin(filePath: string): Promise<Plugin> {
  const currentDir = path.dirname(url.fileURLToPath(import.meta.url));
  const runnerPath = path.join(currentDir, "plugin-ts-runner.js");

  const child = cp.fork(runnerPath, [], {
    execArgv: ["--experimental-strip-types"],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
  });

  let callIdCounter = 0;
  const pendingCalls = new Map<string, CallPending>();
  const activeContexts = new Map<string, RepoContext>();

  child.on("message", function onChildMessage(rawMsg: unknown) {
    const msg = rawMsg as Record<string, unknown>;

    if (msg.type === "call-result" || msg.type === "call-error") {
      const callId = msg.callId as string;
      const pending = pendingCalls.get(callId);
      if (!pending) {
        return;
      }
      pendingCalls.delete(callId);
      activeContexts.delete(callId);
      if (msg.type === "call-error") {
        pending.reject(new Error(msg.error as string));
      }
      else {
        pending.resolve(msg.value);
      }

      return;
    }

    if (msg.type === "ctx-call") {
      const callId = msg.callId as string;
      const ctxCallId = msg.ctxCallId as string;
      const method = msg.method as "readFile" | "listFiles" | "exists";
      const args = msg.args as unknown[];
      const ctx = activeContexts.get(callId);
      if (!ctx) {
        child.send({ type: "ctx-response", ctxCallId, error: "No active context" });

        return;
      }
      const fn = ctx[method] as (...ctxArgs: unknown[]) => Promise<unknown>;
      fn.call(ctx, ...args).then(
        (value) => {
          child.send({ type: "ctx-response", ctxCallId, value });
        },
        (error: unknown) => {
          child.send({ type: "ctx-response", ctxCallId, error: String(error) });
        }
      );
    }
  });

  const serialized = await new Promise<SerializedPlugin>(function awaitPluginLoad(resolve, reject) {
    function onLoadMessage(rawMsg: unknown) {
      const msg = rawMsg as Record<string, unknown>;
      if (msg.type === "loaded") {
        child.off("message", onLoadMessage);
        resolve(msg.plugin as SerializedPlugin);
      }
      else if (msg.type === "load-error") {
        child.off("message", onLoadMessage);
        reject(new Error(msg.error as string));
      }
    }

    child.on("message", onLoadMessage);
    child.once("error", reject);
    child.send({ type: "load", filePath });
  });

  child.once("exit", function onChildExit(code) {
    const exitError = new Error(`Plugin runner exited unexpectedly (code ${code})`);
    for (const pending of pendingCalls.values()) {
      pending.reject(exitError);
    }
    pendingCalls.clear();
    activeContexts.clear();
  });

  function makeApplyFn(operationId: string): Operation["apply"] {
    return async function proxyApply(ctx: RepoContext, inputs: Record<string, unknown>) {
      const callId = `apply-${callIdCounter++}`;
      activeContexts.set(callId, ctx);

      return new Promise<Patch[] | null>(function awaitApply(resolve, reject) {
        pendingCalls.set(callId, {
          resolve: (value) => {
            resolve(value as Patch[] | null);
          },
          reject
        });
        child.send({ type: "call-apply", callId, operationId, inputs, repo: ctx.repo, provider: ctx.provider });
      });
    };
  }

  function makeFilterTestFn(filterId: string): RepoFilter["test"] {
    return async function proxyFilterTest(ctx: RepoContext) {
      const callId = `filter-${callIdCounter++}`;
      activeContexts.set(callId, ctx);

      return new Promise<boolean>(function awaitFilterTest(resolve, reject) {
        pendingCalls.set(callId, {
          resolve: (value) => {
            resolve(value as boolean);
          },
          reject
        });
        child.send({ type: "call-filter-test", callId, filterId, repo: ctx.repo, provider: ctx.provider });
      });
    };
  }

  const operations: Operation[] = serialized.operations.map((opMeta) => {
    return {
      id: opMeta.id,
      name: opMeta.name,
      description: opMeta.description,
      inputs: opMeta.inputs,
      branchName: reconstructFn<Operation["branchName"]>(opMeta.branchNameFn),
      commitMessage: reconstructFn<Operation["commitMessage"]>(opMeta.commitMessageFn),
      prTitle: reconstructFn<Operation["prTitle"]>(opMeta.prTitleFn),
      prDescription: reconstructFn<Operation["prDescription"]>(opMeta.prDescriptionFn),
      apply: makeApplyFn(opMeta.id)
    };
  });

  const filters: RepoFilter[] = serialized.filters.map((filterMeta) => {
    return {
      id: filterMeta.id,
      name: filterMeta.name,
      description: filterMeta.description,
      test: makeFilterTestFn(filterMeta.id)
    };
  });

  const plugin: Plugin = {
    id: serialized.id,
    name: serialized.name,
    version: serialized.version,
    operations,
    filters: filters.length > 0 ? filters : undefined
  };

  registerPlugin(plugin, filePath);

  return plugin;
}

export async function loadPlugin(filePath: string): Promise<Plugin> {
  if (filePath.endsWith(".ts")) {
    return loadTsPlugin(filePath);
  }

  return loadJsPlugin(filePath);
}
