// Import Third-party Dependencies
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import type { LanguageSupport } from "@codemirror/language";

type LanguageExtension = LanguageSupport | null;

export function detectLanguage(filePath: string): LanguageExtension {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) {
    return null;
  }

  const ext = filePath.slice(dot).toLowerCase();

  switch (ext) {
    case ".js":
    case ".mjs":
    case ".cjs":
      return javascript();
    case ".jsx":
      return javascript({ jsx: true });
    case ".ts":
    case ".mts":
    case ".cts":
      return javascript({ typescript: true });
    case ".tsx":
      return javascript({ jsx: true, typescript: true });
    case ".json":
    case ".jsonc":
      return json();
    case ".md":
    case ".mdx":
      return markdown();
    case ".css":
      return css();
    case ".html":
    case ".htm":
      return html();
    default:
      return null;
  }
}
