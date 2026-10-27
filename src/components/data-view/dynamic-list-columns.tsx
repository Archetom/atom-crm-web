import type { ColumnsType } from "antd/es/table";

import {
  formatServerProvidedDynamicField,
  type CustomFieldValues,
  type FieldDefinition,
} from "~/components/dynamic-field";

import type { ColumnPreferenceOption } from "./column-preference";

export interface DynamicListFieldValues {
  customFields?: CustomFieldValues;
}

function listFields(
  definitions: readonly FieldDefinition[],
  existingCodes: readonly string[],
): readonly FieldDefinition[] {
  const usedCodes = new Set(existingCodes);
  return definitions.filter(
    (field) =>
      !usedCodes.has(field.code) &&
      !field.builtin &&
      field.status === "ACTIVE" &&
      field.fieldType !== "FILE",
  );
}

function serverValue(field: FieldDefinition, values: readonly string[]) {
  const display = formatServerProvidedDynamicField(field, values);
  if (display === null) return "—";
  return display.kind === "link" ? (
    <a href={display.href} rel="noreferrer" target="_blank">
      {display.text}
    </a>
  ) : (
    display.text
  );
}

/**
 * Field definitions are fetched only when the caller has `fields:read`; list
 * values are rendered exactly from the server-filtered, server-masked response.
 */
export function dynamicListColumnOptions(
  definitions: readonly FieldDefinition[],
  existingCodes: readonly string[] = [],
): readonly ColumnPreferenceOption[] {
  return listFields(definitions, existingCodes).map((field) => ({
    code: field.code,
    label: field.displayName,
  }));
}

export function dynamicListColumns<T extends DynamicListFieldValues>(
  definitions: readonly FieldDefinition[],
  existingCodes: readonly string[] = [],
): ColumnsType<T> {
  return listFields(definitions, existingCodes).map((field) => ({
    dataIndex: "customFields",
    key: field.code,
    title: field.displayName,
    render: (_: unknown, item) => serverValue(field, item.customFields?.[field.code] ?? []),
  }));
}
