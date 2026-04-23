// Import Third-party Dependencies
import { useState, useEffect } from "react";
import type { InputField } from "@rezzou/core";

// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";
import { InputsForm } from "./InputsForm.js";
import { getDefaultValues } from "../utils/inputsForm.js";

interface OperationInfo {
  id: string;
  name: string;
  description: string;
  inputs?: readonly InputField[];
}

export function OperationPicker() {
  const [operations, setOperations] = useState<OperationInfo[]>([]);
  const [pluginLoading, setPluginLoading] = useState(false);
  const [pluginError, setPluginError] = useState<string | null>(null);
  const [missingPlugins, setMissingPlugins] = useState<string[]>([]);
  const {
    selectedOperationId,
    setSelectedOperation,
    scanRepos,
    isLoading,
    operationInputs,
    setOperationInputs
  } = useAppStore();

  useEffect(() => {
    void window.api.listOperations().then(setOperations);
    void window.api.getMissingPlugins().then((paths) => {
      if (paths.length > 0) {
        setMissingPlugins(paths);
      }
    });

    return window.api.onOperationsChanged(setOperations);
  }, []);

  const selectedOp = operations.find((op) => op.id === selectedOperationId);

  function handleSelectOperation(id: string) {
    setSelectedOperation(id);
    const op = operations.find((o) => o.id === id);
    if (op?.inputs && op.inputs.length > 0) {
      setOperationInputs(getDefaultValues(op.inputs));
    }
  }

  function handleFieldChange(key: string, value: unknown) {
    setOperationInputs({ ...operationInputs, [key]: value });
  }

  async function handleLoadPlugin() {
    setPluginLoading(true);
    setPluginError(null);
    try {
      await window.api.pickAndLoadPlugin();
    }
    catch (err) {
      setPluginError(err instanceof Error ? err.message : String(err));
    }
    finally {
      setPluginLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Select an operation</h2>
        <p className="text-sm text-gray-400">Choose what change to apply across your repositories</p>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        {operations.map((op) => (
          <label
            key={op.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
              selectedOperationId === op.id
                ? "border-blue-500 bg-gray-900"
                : "border-gray-800 bg-gray-900 hover:border-gray-600"
            }`}
          >
            <input
              type="radio"
              name="operation"
              value={op.id}
              checked={selectedOperationId === op.id}
              onChange={() => handleSelectOperation(op.id)}
              className="mt-0.5 accent-blue-600"
            />
            <div>
              <p className="text-sm font-medium">{op.name}</p>
              <p className="text-xs text-gray-400">{op.description}</p>
            </div>
          </label>
        ))}
      </div>

      {selectedOp?.inputs && selectedOp.inputs.length > 0 && (
        <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 px-4 py-4">
          <p className="mb-4 text-sm font-medium text-gray-300">Operation parameters</p>
          <InputsForm
            fields={selectedOp.inputs}
            values={operationInputs}
            onChange={handleFieldChange}
          />
        </div>
      )}

      {missingPlugins.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-700 bg-yellow-950 px-4 py-3">
          <p className="mb-1 text-xs font-medium text-yellow-400">Plugin(s) not found at startup:</p>
          {missingPlugins.map((p) => (
            <p key={p} className="truncate text-xs text-yellow-600">{p}</p>
          ))}
        </div>
      )}

      {pluginError && (
        <p className="mb-4 text-xs text-red-400">{pluginError}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={scanRepos}
          disabled={isLoading || operations.length === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Scanning..." : "Scan repositories"}
        </button>

        <button
          onClick={handleLoadPlugin}
          disabled={pluginLoading}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pluginLoading ? "Loading..." : "Load a plugin…"}
        </button>
      </div>
    </div>
  );
}
