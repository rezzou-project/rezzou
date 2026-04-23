// Import Third-party Dependencies
import type { InputField } from "@rezzou/core";

// Import Internal Dependencies
import { validateField } from "../utils/inputsForm.js";
import { FileContentEditor } from "./FileContentEditor.js";

interface InputsFormProps {
  fields: readonly InputField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function InputsForm({ fields, values, onChange }: InputsFormProps) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const value = values[field.name];
        const error = validateField(field, value);

        return (
          <div key={field.name}>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              {field.label}
              {field.required && <span className="ml-1 text-red-400">*</span>}
            </label>
            {field.description && (
              <p className="mb-1 text-xs text-gray-500">{field.description}</p>
            )}
            <FieldInput field={field} value={value} values={values} onChange={(v) => onChange(field.name, v)} />
            {error && (
              <p className="mt-1 text-xs text-red-400">{error}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface FieldInputProps {
  field: InputField;
  value: unknown;
  values: Record<string, unknown>;
  onChange: (value: unknown) => void;
}

function FieldInput({ field, value, values, onChange }: FieldInputProps) {
  const baseInputClass = "w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none";

  if (field.type === "file-content") {
    const filePath = field.relatedPathField
      ? String(values[field.relatedPathField] ?? "")
      : "";

    return (
      <FileContentEditor
        value={String(value ?? "")}
        filePath={filePath}
        onChange={onChange}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-blue-600"
        />
        <span className="text-sm text-gray-400">Enabled</span>
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <select
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className={baseInputClass}
      >
        {!field.required && <option value="">— Select —</option>}
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  if (field.type === "multiselect") {
    const selected = Array.isArray(value) ? (value as string[]) : [];

    return (
      <div className="flex flex-col gap-1">
        {(field.options ?? []).map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, opt.value]
                  : selected.filter((v) => v !== opt.value);
                onChange(next);
              }}
              className="accent-blue-600"
            />
            <span className="text-sm text-gray-300">{opt.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <input
        type="number"
        value={value === undefined || value === null ? "" : String(value)}
        min={field.min}
        max={field.max}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className={baseInputClass}
      />
    );
  }

  return (
    <input
      type="text"
      value={String(value ?? "")}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={baseInputClass}
    />
  );
}
