// Import Third-party Dependencies
import { useState, useEffect } from "react";

// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";

interface OperationInfo {
  id: string;
  name: string;
  description: string;
}

export function OperationPicker() {
  const [operations, setOperations] = useState<OperationInfo[]>([]);
  const { selectedOperationId, setSelectedOperation, scanRepos, isLoading } = useAppStore();

  useEffect(() => {
    void window.api.listOperations().then(setOperations);
  }, []);

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
              onChange={() => setSelectedOperation(op.id)}
              className="mt-0.5 accent-blue-600"
            />
            <div>
              <p className="text-sm font-medium">{op.name}</p>
              <p className="text-xs text-gray-400">{op.description}</p>
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={scanRepos}
        disabled={isLoading || operations.length === 0}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Scanning..." : "Scan repositories"}
      </button>
    </div>
  );
}
