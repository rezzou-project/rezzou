// Import Third-party Dependencies
import { useState, useEffect } from "react";

// Import Internal Dependencies
import { useAppStore } from "../stores/app.js";

interface LoadedPluginInfo {
  id: string;
  name: string;
  version: string;
  filePath: string;
  source: "persisted" | "auto-scanned";
}

export function PluginsSettings() {
  const goHome = useAppStore((state) => state.goHome);
  const [plugins, setPlugins] = useState<LoadedPluginInfo[]>([]);
  const [missingPlugins, setMissingPlugins] = useState<string[]>([]);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void window.api.listPlugins().then(setPlugins);
    void window.api.getMissingPlugins().then(setMissingPlugins);

    const unsubscribe = window.api.onPluginsChanged(setPlugins);

    return unsubscribe;
  }, []);

  async function handleReload(filePath: string) {
    setLoadingPath(filePath);
    setError(null);
    try {
      await window.api.reloadPlugin(filePath);
    }
    catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    finally {
      setLoadingPath(null);
    }
  }

  async function handleUnload(filePath: string) {
    setError(null);
    try {
      await window.api.unloadPlugin(filePath);
    }
    catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleLoadPlugin() {
    setError(null);
    try {
      await window.api.pickAndLoadPlugin();
    }
    catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Plugins</h2>
          <p className="text-sm text-gray-400">Manage loaded plugins</p>
        </div>
        <button
          type="button"
          onClick={goHome}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
        >
          ← Back
        </button>
      </div>

      {error !== null && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {missingPlugins.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-700 bg-yellow-950 px-4 py-3">
          <p className="mb-1 text-xs font-medium text-yellow-400">Not found at startup:</p>
          {missingPlugins.map((filePath) => (
            <p key={filePath} className="truncate text-xs text-yellow-600">{filePath}</p>
          ))}
        </div>
      )}

      {plugins.length === 0 ? (
        <p className="text-sm text-gray-500">No plugins loaded.</p>
      ) : (
        <div className="space-y-2">
          {plugins.map((plugin) => (
            <div
              key={plugin.filePath}
              className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{plugin.name}</span>
                  <span className="text-xs text-gray-500">v{plugin.version}</span>
                  {plugin.source === "auto-scanned" && (
                    <span className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">auto</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500">{plugin.filePath}</p>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleReload(plugin.filePath)}
                  disabled={loadingPath === plugin.filePath}
                  className="rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingPath === plugin.filePath ? "…" : "Reload"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleUnload(plugin.filePath)}
                  disabled={loadingPath === plugin.filePath}
                  className="rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={() => void handleLoadPlugin()}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          Load a plugin…
        </button>
      </div>
    </div>
  );
}
