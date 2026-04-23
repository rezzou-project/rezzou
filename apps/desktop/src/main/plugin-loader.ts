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
  type InputField,
  type ProviderAdapter,
  type ProviderDescriptor,
  type Namespace,
  type Repo,
  type FileContent,
  type SubmitParams,
  type SubmitResult,
  type Member,
  type RepoStats
} from "@rezzou/sdk";

// Import Internal Dependencies
import { registry as operationRegistry } from "./operation-registry.ts";
import { filterRegistry } from "./filter-registry.ts";
import { providerRegistry } from "./provider-registry.ts";

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

interface SerializedProviderDescriptor {
  provider: string;
  name: string;
}

interface SerializedPlugin {
  id: string;
  name: string;
  version: string;
  operations: SerializedOperation[];
  filters: Array<{ id: string; name: string; description?: string; }>;
  providers: SerializedProviderDescriptor[];
}

interface LoadedPluginEntry {
  operationIds: string[];
  filterIds: string[];
  providerIds: string[];
}

interface ProxyProviderAdapterOptions {
  provider: string;
  adapterKey: string;
  child: cp.ChildProcess;
  pendingCalls: Map<string, CallPending>;
  getCallId: () => string;
}

class ProxyProviderAdapter implements ProviderAdapter {
  readonly provider: string;
  readonly #adapterKey: string;
  readonly #child: cp.ChildProcess;
  readonly #pendingCalls: Map<string, CallPending>;
  readonly #getCallId: () => string;

  constructor(options: ProxyProviderAdapterOptions) {
    this.provider = options.provider;
    this.#adapterKey = options.adapterKey;
    this.#child = options.child;
    this.#pendingCalls = options.pendingCalls;
    this.#getCallId = options.getCallId;
  }

  #callMethod(method: string, args: unknown[]): Promise<unknown> {
    const callId = this.#getCallId();
    const { promise, resolve, reject } = Promise.withResolvers<unknown>();
    this.#pendingCalls.set(callId, { resolve, reject });
    this.#child.send({ type: "call-adapter", callId, adapterKey: this.#adapterKey, method, args });

    return promise;
  }

  listNamespaces(): Promise<Namespace[]> {
    return this.#callMethod("listNamespaces", []) as Promise<Namespace[]>;
  }

  listRepos(namespace: string): Promise<Repo[]> {
    return this.#callMethod("listRepos", [namespace]) as Promise<Repo[]>;
  }

  getFile(repoPath: string, filePath: string, branch: string): Promise<FileContent | null> {
    return this.#callMethod("getFile", [repoPath, filePath, branch]) as Promise<FileContent | null>;
  }

  listTree(repoPath: string, branch: string): Promise<string[]> {
    return this.#callMethod("listTree", [repoPath, branch]) as Promise<string[]>;
  }

  branchExists(repoPath: string, branch: string): Promise<boolean> {
    return this.#callMethod("branchExists", [repoPath, branch]) as Promise<boolean>;
  }

  submitChanges(params: SubmitParams): Promise<SubmitResult> {
    return this.#callMethod("submitChanges", [params]) as Promise<SubmitResult>;
  }

  listMembers(namespace: string): Promise<Member[]> {
    return this.#callMethod("listMembers", [namespace]) as Promise<Member[]>;
  }

  getRepoStats(repoPath: string): Promise<RepoStats> {
    return this.#callMethod("getRepoStats", [repoPath]) as Promise<RepoStats>;
  }
}

const loadedPlugins = new Map<string, LoadedPluginEntry>();

function registerPlugin(plugin: Plugin, filePath: string): void {
  const operationIds: string[] = [];
  const filterIds: string[] = [];
  const providerIds: string[] = [];

  for (const operation of plugin.operations) {
    operationRegistry.register(operation);
    operationIds.push(operation.id);
  }
  for (const filter of plugin.filters ?? []) {
    filterRegistry.register(filter);
    filterIds.push(filter.id);
  }
  for (const descriptor of plugin.providers ?? []) {
    providerRegistry.register(descriptor);
    providerIds.push(descriptor.provider);
  }

  loadedPlugins.set(filePath, { operationIds, filterIds, providerIds });
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
  for (const id of entry.providerIds) {
    providerRegistry.unregister(id);
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

  function makeProviderDescriptor(meta: SerializedProviderDescriptor): ProviderDescriptor {
    return {
      provider: meta.provider,
      name: meta.name,
      async create(token: string): Promise<ProviderAdapter> {
        const callId = `provider-create-${callIdCounter++}`;
        const { promise, resolve, reject } = Promise.withResolvers<string>();
        pendingCalls.set(callId, {
          resolve: (value) => resolve(value as string),
          reject
        });
        child.send({ type: "create-provider", callId, provider: meta.provider, token });
        const adapterKey = await promise;

        return new ProxyProviderAdapter({
          provider: meta.provider,
          adapterKey,
          child,
          pendingCalls,
          getCallId: () => `adapter-call-${callIdCounter++}`
        });
      }
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

  const providers: ProviderDescriptor[] = (serialized.providers ?? []).map(makeProviderDescriptor);

  const plugin: Plugin = {
    id: serialized.id,
    name: serialized.name,
    version: serialized.version,
    operations,
    filters: filters.length > 0 ? filters : undefined,
    providers: providers.length > 0 ? providers : undefined
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
