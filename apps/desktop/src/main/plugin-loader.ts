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

type OperationStringFn = "branchName" | "commitMessage" | "prTitle" | "prDescription";

interface CallPending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface SerializedOperation {
  id: string;
  name: string;
  description: string;
  inputs?: InputField[];
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

  const { promise: loadPromise, resolve: resolveLoad, reject: rejectLoad } = Promise.withResolvers<SerializedPlugin>();

  function onLoadMessage(rawMsg: unknown) {
    const msg = rawMsg as Record<string, unknown>;
    if (msg.type === "loaded") {
      child.off("message", onLoadMessage);
      resolveLoad(msg.plugin as SerializedPlugin);
    }
    else if (msg.type === "load-error") {
      child.off("message", onLoadMessage);
      rejectLoad(new Error(msg.error as string));
    }
  }

  child.on("message", onLoadMessage);
  child.once("error", rejectLoad);
  child.send({ type: "load", filePath });

  const serialized = await loadPromise;

  child.once("exit", function onChildExit(code) {
    const exitError = new Error(`Plugin runner exited unexpectedly (code ${code})`);
    for (const pending of pendingCalls.values()) {
      pending.reject(exitError);
    }
    pendingCalls.clear();
    activeContexts.clear();
  });

  function makeApplyFn(operationId: string): Operation["apply"] {
    return function proxyApply(ctx: RepoContext, inputs: Record<string, unknown>) {
      const callId = `apply-${callIdCounter++}`;
      activeContexts.set(callId, ctx);
      const { promise, resolve, reject } = Promise.withResolvers<Patch[] | null>();
      pendingCalls.set(callId, {
        resolve: (value) => resolve(value as Patch[] | null),
        reject
      });
      child.send({ type: "call-apply", callId, operationId, inputs, repo: ctx.repo, provider: ctx.provider });

      return promise;
    };
  }

  function makeOperationStringFn(
    operationId: string,
    fnName: OperationStringFn
  ): (inputs: Record<string, unknown>) => Promise<string> {
    return function proxyStringFn(inputs: Record<string, unknown>) {
      const callId = `${fnName}-${callIdCounter++}`;
      const { promise, resolve, reject } = Promise.withResolvers<string>();
      pendingCalls.set(callId, {
        resolve: (value) => resolve(value as string),
        reject
      });
      child.send({ type: `call-${fnName}`, callId, operationId, inputs });

      return promise;
    };
  }

  function makeFilterTestFn(filterId: string): RepoFilter["test"] {
    return function proxyFilterTest(ctx: RepoContext) {
      const callId = `filter-${callIdCounter++}`;
      activeContexts.set(callId, ctx);
      const { promise, resolve, reject } = Promise.withResolvers<boolean>();
      pendingCalls.set(callId, {
        resolve: (value) => resolve(value as boolean),
        reject
      });
      child.send({ type: "call-filter-test", callId, filterId, repo: ctx.repo, provider: ctx.provider });

      return promise;
    };
  }

  const operations: Operation[] = serialized.operations.map((opMeta) => {
    return {
      id: opMeta.id,
      name: opMeta.name,
      description: opMeta.description,
      inputs: opMeta.inputs,
      branchName: makeOperationStringFn(opMeta.id, "branchName"),
      commitMessage: makeOperationStringFn(opMeta.id, "commitMessage"),
      prTitle: makeOperationStringFn(opMeta.id, "prTitle"),
      prDescription: makeOperationStringFn(opMeta.id, "prDescription"),
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
