import { Descriptions } from "antd";

import type { CustomFieldValues } from "../model/custom-field-values";
import type { FieldDefinition } from "../model/field-definition";
import {
  formatServerProvidedDynamicField,
  serverProvidedDynamicFields,
} from "../model/server-provided-dynamic-field";

export function ServerProvidedDynamicFieldDescriptions({
  columns,
  definitions,
  values,
}: Readonly<{
  columns: number | Partial<Record<"lg" | "md" | "sm" | "xl" | "xs" | "xxl", number>>;
  definitions: readonly FieldDefinition[];
  values: CustomFieldValues | undefined;
}>) {
  const fields = serverProvidedDynamicFields(definitions, values);
  if (fields.length === 0) return null;

  return (
    <Descriptions
      column={columns}
      items={fields.flatMap(({ field, values: fieldValues }) => {
        const display = formatServerProvidedDynamicField(field, fieldValues);
        if (display === null) return [];
        return [
          {
            children:
              display.kind === "link" ? (
                <a href={display.href} rel="noreferrer" target="_blank">
                  {display.text}
                </a>
              ) : (
                display.text
              ),
            key: field.code,
            label: field.displayName,
          },
        ];
      })}
      size="small"
    />
  );
}
