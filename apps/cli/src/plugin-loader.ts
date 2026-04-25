// Import Node.js Dependencies
import * as path from "node:path";
import * as url from "node:url";
import * as cp from "node:child_process";

// Import Third-party Dependencies
import {
  parsePlugin,
  type Operation,
  type Patch,
  type RepoContext,
  type InputField
} from "@rezzou/sdk";

// CONSTANTS
const kCurrentDir = path.dirname(url.fileURLToPath(import.meta.url));
const kRunnerPath = path.join(kCurrentDir, "plugin-ts-runner.js");

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
}

interface CallPending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

type OperationStringFn = "branchName" | "commitMessage" | "prTitle" | "prDescription";

async function loadJsPlugin(filePath: string): Promise<Operation[]> {
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

  return plugin.operations as Operation[];
}

async function loadTsPlugin(filePath: string): Promise<Operation[]> {
  const child = cp.fork(kRunnerPath, [], {
    execArgv: ["--experimental-strip-types"]
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

  function makeStringFn(
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

  return serialized.operations.map((opMeta) => ({
    id: opMeta.id,
    name: opMeta.name,
    description: opMeta.description,
    inputs: opMeta.inputs,
    branchName: makeStringFn(opMeta.id, "branchName"),
    commitMessage: makeStringFn(opMeta.id, "commitMessage"),
    prTitle: makeStringFn(opMeta.id, "prTitle"),
    prDescription: makeStringFn(opMeta.id, "prDescription"),
    apply: makeApplyFn(opMeta.id)
  } as Operation));
}

export async function loadPluginOperations(paths: string[]): Promise<Map<string, Operation>> {
  const operations = new Map<string, Operation>();

  for (const filePath of paths) {
    try {
      const ops = filePath.endsWith(".ts")
        ? await loadTsPlugin(filePath)
        : await loadJsPlugin(filePath);

      for (const op of ops) {
        operations.set(op.id, op);
      }
    }
    catch (error) {
      console.warn(`Warning: failed to load plugin "${filePath}": ${String(error)}`);
    }
  }

  return operations;
}
