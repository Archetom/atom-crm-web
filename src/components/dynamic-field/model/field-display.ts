import type { EffectiveFieldAccess, FieldDefinition, FieldOption } from "./field-definition";

export type FieldDisplay =
  | { kind: "empty" | "hidden" }
  | { kind: "masked"; text: string }
  | { kind: "text"; text: string }
  | { kind: "link"; href: string; text: string };

function displayValues(values: readonly string[]): readonly string[] {
  return values.filter((value) => value.length > 0);
}

function optionLabel(value: string, options: readonly FieldOption[]): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function formatDynamicFieldDisplay(
  field: FieldDefinition,
  values: readonly string[],
  access: EffectiveFieldAccess,
): FieldDisplay {
  // Do not inspect or transform values that the caller cannot view.
  if (access.level === "HIDDEN") return { kind: "hidden" };
  if (access.maskType === "FULL") return { kind: "masked", text: "已脱敏" };

  const presentValues = displayValues(values);
  if (presentValues.length === 0) return { kind: "empty" };

  switch (field.fieldType) {
    case "BOOLEAN": {
      const [value] = presentValues;
      return { kind: "text", text: value === "true" ? "是" : value === "false" ? "否" : value };
    }
    case "SELECT":
    case "MULTI_SELECT":
      return {
        kind: "text",
        text: presentValues.map((value) => optionLabel(value, field.options)).join("、"),
      };
    case "FILE":
      return { kind: "text", text: `已关联 ${presentValues.length} 个文件` };
    case "URL": {
      const [value] = presentValues;
      const href = presentValues.length === 1 ? safeExternalUrl(value) : null;
      return href
        ? { kind: "link", href, text: value }
        : { kind: "text", text: presentValues.join("、") };
    }
    case "TEXT":
    case "TEXTAREA":
    case "DATE":
    case "DATETIME":
    case "INTEGER":
    case "DECIMAL":
    case "EMAIL":
    case "PHONE":
    case "USER":
    case "DEPARTMENT":
    case "RELATION":
    case "ADDRESS":
      return { kind: "text", text: presentValues.join("、") };
  }
}
