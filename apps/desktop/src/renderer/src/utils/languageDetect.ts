// Import Third-party Dependencies
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import type { LanguageSupport } from "@codemirror/language";

type LanguageExtension = LanguageSupport | null;

const kExtensionMap: Record<string, () => LanguageExtension> = {
  ".js": () => javascript(),
  ".mjs": () => javascript(),
  ".cjs": () => javascript(),
  ".jsx": () => javascript({ jsx: true }),
  ".ts": () => javascript({ typescript: true }),
  ".mts": () => javascript({ typescript: true }),
  ".cts": () => javascript({ typescript: true }),
  ".tsx": () => javascript({ jsx: true, typescript: true }),
  ".json": () => json(),
  ".jsonc": () => json(),
  ".md": () => markdown(),
  ".mdx": () => markdown(),
  ".css": () => css(),
  ".html": () => html(),
  ".htm": () => html()
};

export function detectLanguage(filePath: string): LanguageExtension {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) {
    return null;
  }

  const ext = filePath.slice(dot).toLowerCase();
  const factory = kExtensionMap[ext];

  return factory ? factory() : null;
}
