// Import Third-party Dependencies
import { useState } from "react";
import type { FormEvent } from "react";

// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";

export function SetupForm() {
  const [token, setToken] = useState("");
  const [groupPath, setGroupPath] = useState("");
  const { connect, isLoading, error } = useAppStore();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await connect(token, groupPath);
  }

  return (
    <div className="flex flex-col items-center justify-center pt-20">
      <div className="w-full max-w-md">
        <h2 className="mb-2 text-2xl font-semibold">Connect to GitLab</h2>
        <p className="mb-8 text-sm text-gray-400">
          Enter your Personal Access Token and the group path to get started.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="token" className="text-sm font-medium text-gray-300">
              Personal Access Token
            </label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              required
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="group" className="text-sm font-medium text-gray-300">
              Group path
            </label>
            <input
              id="group"
              type="text"
              value={groupPath}
              onChange={(event) => setGroupPath(event.target.value)}
              placeholder="my-org/my-group"
              required
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {error !== null && (
            <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || token.length === 0 || groupPath.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Connecting..." : "Connect"}
          </button>
        </form>
      </div>
    </div>
  );
}
