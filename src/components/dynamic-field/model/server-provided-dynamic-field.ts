import type { CustomFieldValues } from "./custom-field-values";
import type { FieldDefinition } from "./field-definition";

export interface ServerProvidedDynamicField {
  field: FieldDefinition;
  values: readonly string[];
}

export type ServerProvidedDynamicFieldDisplay =
  { kind: "text"; text: string } | { href: string; kind: "link"; text: string };

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

/**
 * Detail responses already apply the caller's field policy. This helper only
 * pairs those server-returned values with active metadata for a label; it does
 * not infer whether the caller may read, write, or unmask a field.
 */
export function serverProvidedDynamicFields(
  definitions: readonly FieldDefinition[],
  values: CustomFieldValues | undefined,
): readonly ServerProvidedDynamicField[] {
  if (values === undefined) return [];

  return definitions.flatMap((field) => {
    if (
      field.builtin ||
      field.status !== "ACTIVE" ||
      field.fieldType === "FILE" ||
      values[field.code] === undefined
    ) {
      return [];
    }
    const fieldValues = values[field.code].filter((value) => value.length > 0);
    return fieldValues.length === 0 ? [] : [{ field, values: fieldValues }];
  });
}

/** Formats only values already filtered and, where applicable, masked by the server. */
export function formatServerProvidedDynamicField(
  field: FieldDefinition,
  values: readonly string[],
): ServerProvidedDynamicFieldDisplay | null {
  const presentValues = values.filter((value) => value.length > 0);
  if (presentValues.length === 0) return null;

  if (field.fieldType === "SELECT" || field.fieldType === "MULTI_SELECT") {
    return {
      kind: "text",
      text: presentValues
        .map((value) => field.options.find((option) => option.value === value)?.label ?? value)
        .join("、"),
    };
  }
  if (field.fieldType === "BOOLEAN") {
    return {
      kind: "text",
      text: presentValues
        .map((value) => (value === "true" ? "是" : value === "false" ? "否" : value))
        .join("、"),
    };
  }
  if (field.fieldType === "URL" && presentValues.length === 1) {
    const href = safeExternalUrl(presentValues[0]);
    if (href !== null) return { href, kind: "link", text: presentValues[0] };
  }
  return { kind: "text", text: presentValues.join("、") };
}
