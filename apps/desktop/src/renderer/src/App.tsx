// Import Third-party Dependencies
import { useEffect } from "react";

// Import Internal Dependencies
import { useAppStore } from "./stores/app.js";
import { SetupForm } from "./components/SetupForm.js";
import { RepoList } from "./components/RepoList.js";
import { OperationPicker } from "./components/OperationPicker.js";
import { DiffReview } from "./components/DiffReview.js";
import { ResultPanel } from "./components/ResultPanel.js";

export function App() {
  const step = useAppStore((state) => state.step);
  const reset = useAppStore((state) => state.reset);
  const autoLogin = useAppStore((state) => state.autoLogin);

  useEffect(() => {
    void autoLogin();
  }, [autoLogin]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4">
        <button onClick={reset} className="text-left">
          <h1 className="text-xl font-semibold tracking-tight hover:text-gray-300 transition-colors">
            Rezzou
          </h1>
          <p className="text-sm text-gray-400">Bulk repository maintenance</p>
        </button>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {step === "connect" && <SetupForm />}
        {step === "repos" && <RepoList />}
        {step === "pick-operation" && <OperationPicker />}
        {step === "diffs" && <DiffReview />}
        {step === "results" && <ResultPanel />}
      </main>
    </div>
  );
}
