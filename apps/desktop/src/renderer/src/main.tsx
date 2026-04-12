// Import Third-party Dependencies
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Import Internal Dependencies
import { App } from "./App.js";
import "./index.css";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
