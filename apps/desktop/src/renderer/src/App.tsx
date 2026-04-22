// Import Third-party Dependencies
import { useEffect } from "react";

// Import Internal Dependencies
import { useAppStore } from "./stores/app.js";
import { SetupForm } from "./components/SetupForm.js";
import { Sidebar } from "./components/Sidebar.js";
import { HomePage } from "./components/HomePage.js";
import { RepoDashboard } from "./components/RepoDashboard.js";
import { OperationPicker } from "./components/OperationPicker.js";
import { DiffReview } from "./components/DiffReview.js";
import { ResultPanel } from "./components/ResultPanel.js";
import { PluginsSettings } from "./components/PluginsSettings.js";
import { HistoryPanel } from "./components/HistoryPanel.js";

export function App() {
  const step = useAppStore((state) => state.step);
  const autoLogin = useAppStore((state) => state.autoLogin);

  useEffect(() => {
    void autoLogin();
  }, [autoLogin]);

  if (step === "connect") {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <header className="border-b border-gray-800 px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight">Rezzou</h1>
          <p className="text-sm text-gray-400">Bulk repository maintenance</p>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-8">
          <SetupForm />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto w-full max-w-4xl px-6 py-8">
          {step === "home" && <HomePage />}
          {step === "repos" && <RepoDashboard />}
          {step === "pick-operation" && <OperationPicker />}
          {step === "diffs" && <DiffReview />}
          {step === "results" && <ResultPanel />}
          {step === "plugins" && <PluginsSettings />}
          {step === "history" && <HistoryPanel />}
        </main>
      </div>
    </div>
  );
}
