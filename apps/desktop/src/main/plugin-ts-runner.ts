// Import Node.js Dependencies
import * as url from "node:url";

// Import Third-party Dependencies
import {
  parsePlugin,
  type Operation,
  type RepoContext,
  type RepoFilter,
  type Repo,
  type Provider,
  type ProviderAdapter,
  type ProviderDescriptor
} from "@rezzou/sdk";

interface CallPending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface LoadMessage {
  type: "load";
  filePath: string;
}

interface CallApplyMessage {
  type: "call-apply";
  callId: string;
  operationId: string;
  inputs: Record<string, unknown>;
  repo: Repo;
  provider: Provider;
}

interface CallFilterTestMessage {
  type: "call-filter-test";
  callId: string;
  filterId: string;
  repo: Repo;
  provider: Provider;
}

interface CallOperationStringMessage {
  type: "call-branchName" | "call-commitMessage" | "call-prTitle" | "call-prDescription";
  callId: string;
  operationId: string;
  inputs: Record<string, unknown>;
}

interface CreateProviderMessage {
  type: "create-provider";
  callId: string;
  provider: string;
  token: string;
}

interface CallAdapterMessage {
  type: "call-adapter";
  callId: string;
  adapterKey: string;
  method: string;
  args: unknown[];
}

interface CtxResponseMessage {
  type: "ctx-response";
  ctxCallId: string;
  value?: unknown;
  error?: string;
}

type OperationStringFn = "branchName" | "commitMessage" | "prTitle" | "prDescription";

interface CallStringFnOptions {
  callId: string;
  operationId: string;
  fnName: OperationStringFn;
  inputs: Record<string, unknown>;
}

type IncomingMessage =
  | LoadMessage
  | CallApplyMessage
  | CallFilterTestMessage
  | CallOperationStringMessage
  | CreateProviderMessage
  | CallAdapterMessage
  | CtxResponseMessage;

let plugin: ReturnType<typeof parsePlugin> | null = null;
const pendingCtxCalls = new Map<string, CallPending>();
const createdAdapters = new Map<string, ProviderAdapter>();
let ctxCallIdCounter = 0;
let adapterKeyCounter = 0;

function createContextProxy(callId: string, repo: Repo, provider: Provider): RepoContext {
  function proxyCall(method: "readFile" | "listFiles" | "exists", args: unknown[]): Promise<unknown> {
    const ctxCallId = `ctx-${ctxCallIdCounter++}`;

    return new Promise(function awaitCtxResponse(resolve, reject) {
      pendingCtxCalls.set(ctxCallId, { resolve, reject });
      process.send!({ type: "ctx-call", callId, ctxCallId, method, args });
    });
  }

  return {
    repo,
    provider,
    readFile: (path) => proxyCall("readFile", [path]) as Promise<string | null>,
    listFiles: (glob) => proxyCall("listFiles", [glob]) as Promise<string[]>,
    exists: (path) => proxyCall("exists", [path]) as Promise<boolean>
  };
}

async function callOperationStringFn(options: CallStringFnOptions): Promise<void> {
  const { callId, operationId, fnName, inputs } = options;
  const operation = plugin!.operations.find((op: Operation) => op.id === operationId);
  if (!operation) {
    process.send!({ type: "call-error", callId, error: `Operation not found: ${operationId}` });

    return;
  }

  try {
    const value = await operation[fnName](inputs);
    process.send!({ type: "call-result", callId, value });
  }
  catch (error) {
    process.send!({ type: "call-error", callId, error: String(error) });
  }
}

async function handleMessage(msg: IncomingMessage): Promise<void> {
  if (msg.type === "load") {
    try {
      const fileUrl = url.pathToFileURL(msg.filePath).href;
      const mod = await import(fileUrl);
      const raw: unknown = (mod as Record<string, unknown>).default ?? mod;
      plugin = parsePlugin(raw);

      const serialized = {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        operations: plugin.operations.map((operation: Operation) => {
          return {
            id: operation.id,
            name: operation.name,
            description: operation.description,
            inputs: operation.inputs ? [...operation.inputs] : undefined
          };
        }),
        filters: (plugin.filters ?? []).map((filter: RepoFilter) => {
          return {
            id: filter.id,
            name: filter.name,
            description: filter.description
          };
        }),
        providers: (plugin.providers ?? []).map((descriptor: ProviderDescriptor) => {
          return {
            provider: descriptor.provider,
            name: descriptor.name
          };
        })
      };

      process.send!({ type: "loaded", plugin: serialized });
    }
    catch (error) {
      process.send!({ type: "load-error", error: String(error) });
    }

    return;
  }

  if (msg.type === "ctx-response") {
    const pending = pendingCtxCalls.get(msg.ctxCallId);
    if (pending) {
      pendingCtxCalls.delete(msg.ctxCallId);
      if (msg.error === undefined) {
        pending.resolve(msg.value);
      }
      else {
        pending.reject(new Error(msg.error));
      }
    }

    return;
  }

  if (plugin === null) {
    const { callId } = msg as { callId: string; };
    process.send!({ type: "call-error", callId, error: "Plugin not loaded" });

    return;
  }

  if (msg.type === "call-apply") {
    const operation = plugin.operations.find(
      (op: Operation) => op.id === msg.operationId
    );
    if (!operation) {
      process.send!({ type: "call-error", callId: msg.callId, error: `Operation not found: ${msg.operationId}` });

      return;
    }

    try {
      const ctx = createContextProxy(msg.callId, msg.repo, msg.provider);
      const value = await operation.apply(ctx, msg.inputs);
      process.send!({ type: "call-result", callId: msg.callId, value });
    }
    catch (error) {
      process.send!({ type: "call-error", callId: msg.callId, error: String(error) });
    }

    return;
  }

  if (msg.type === "call-filter-test") {
    const filter = plugin.filters?.find(
      (repoFilter: RepoFilter) => repoFilter.id === msg.filterId
    );
    if (!filter) {
      process.send!({ type: "call-error", callId: msg.callId, error: `Filter not found: ${msg.filterId}` });

      return;
    }

    try {
      const ctx = createContextProxy(msg.callId, msg.repo, msg.provider);
      const value = await filter.test(ctx);
      process.send!({ type: "call-result", callId: msg.callId, value });
    }
    catch (error) {
      process.send!({ type: "call-error", callId: msg.callId, error: String(error) });
    }

    return;
  }

  if (msg.type === "call-branchName") {
    await callOperationStringFn({ callId: msg.callId, operationId: msg.operationId, fnName: "branchName", inputs: msg.inputs });

    return;
  }

  if (msg.type === "call-commitMessage") {
    await callOperationStringFn({
      callId: msg.callId, operationId: msg.operationId, fnName: "commitMessage", inputs: msg.inputs
    });

    return;
  }

  if (msg.type === "call-prTitle") {
    await callOperationStringFn({
      callId: msg.callId, operationId: msg.operationId, fnName: "prTitle", inputs: msg.inputs
    });

    return;
  }

  if (msg.type === "call-prDescription") {
    await callOperationStringFn({
      callId: msg.callId, operationId: msg.operationId, fnName: "prDescription", inputs: msg.inputs
    });

    return;
  }

  if (msg.type === "create-provider") {
    const descriptor = plugin.providers?.find(
      (d: ProviderDescriptor) => d.provider === msg.provider
    );
    if (!descriptor) {
      process.send!({ type: "call-error", callId: msg.callId, error: `Provider not found: ${msg.provider}` });

      return;
    }
    try {
      const adapter = await Promise.resolve(descriptor.create(msg.token));
      const adapterKey = `adapter-${adapterKeyCounter++}`;
      createdAdapters.set(adapterKey, adapter);
      process.send!({ type: "call-result", callId: msg.callId, value: adapterKey });
    }
    catch (error) {
      process.send!({ type: "call-error", callId: msg.callId, error: String(error) });
    }

    return;
  }

  if (msg.type === "call-adapter") {
    const adapter = createdAdapters.get(msg.adapterKey);
    if (!adapter) {
      process.send!({ type: "call-error", callId: msg.callId, error: `Adapter not found: ${msg.adapterKey}` });

      return;
    }
    try {
      const method = adapter[msg.method as keyof ProviderAdapter];
      if (typeof method !== "function") {
        process.send!({ type: "call-error", callId: msg.callId, error: `Not a method: ${msg.method}` });

        return;
      }
      const value = await (method as (...args: unknown[]) => Promise<unknown>).call(adapter, ...msg.args);
      process.send!({ type: "call-result", callId: msg.callId, value });
    }
    catch (error) {
      process.send!({ type: "call-error", callId: msg.callId, error: String(error) });
    }
  }
}

process.on("message", handleMessage);
