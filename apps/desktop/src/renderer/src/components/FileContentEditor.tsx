// Import Third-party Dependencies
import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";

// Import Internal Dependencies
import { detectLanguage } from "../utils/languageDetect.js";
import { checkSensitivePath, checkSensitiveContent } from "../utils/sensitiveFile.js";
import { shouldCheckNewline, isMissingNewline } from "../utils/noNewlineExtension.js";

// CONSTANTS
const kOneDarkBg = "#282c34";
const kOneDarkBorder = "#3e4452";

interface FileContentEditorProps {
  value: string;
  filePath?: string;
  onChange: (value: string) => void;
}

export function FileContentEditor({ value, filePath = "", onChange }: FileContentEditorProps) {
  const extensions = useMemo(() => {
    const lang = detectLanguage(filePath);

    return lang ? [lang] : [];
  }, [filePath]);

  const showNoNewlineWarning = shouldCheckNewline(filePath) && isMissingNewline(value);
  const pathWarning = filePath ? checkSensitivePath(filePath) : null;
  const contentWarning = value ? checkSensitiveContent(value) : null;
  const securityWarning = pathWarning ?? contentWarning;

  return (
    <div className="flex flex-col gap-2">
      {securityWarning && (
        <div className="flex items-start gap-2 rounded-md border border-amber-600 bg-amber-950 px-3 py-2">
          <span className="mt-0.5 shrink-0 text-amber-400">⚠</span>
          <p className="text-xs text-amber-300">{securityWarning.message}</p>
        </div>
      )}
      <div className="overflow-hidden rounded-md border border-gray-700 text-sm">
        <CodeMirror
          value={value}
          theme={oneDark}
          extensions={extensions}
          onChange={onChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            autocompletion: false
          }}
          style={{ fontSize: "13px" }}
        />
        {showNoNewlineWarning && (
          <div
            style={{
              backgroundColor: kOneDarkBg,
              borderTop: `1px solid ${kOneDarkBorder}`,
              fontFamily: "monospace",
              fontSize: "12px"
            }}
            className="flex select-none items-center gap-2 px-3 py-1"
          >
            <span style={{ color: "#e5c07b" }}>⚠</span>
            <span style={{ color: "#5c6370", fontStyle: "italic" }}>No newline at end of file</span>
          </div>
        )}
      </div>
      {filePath && (
        <p className="text-right text-xs text-gray-600">
          {detectLanguage(filePath) ? filePath.split(".").pop()?.toUpperCase() : "Plain text"}
          {" · "}{value.split("\n").length} line{value.split("\n").length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
