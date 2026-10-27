import type { EffectiveFieldAccess, FieldDefinition } from "../model/field-definition";
import { formatDynamicFieldDisplay } from "../model/field-display";

export function DynamicFieldDisplay({
  access,
  field,
  values,
}: Readonly<{
  access: EffectiveFieldAccess;
  field: FieldDefinition;
  values: readonly string[];
}>) {
  const display = formatDynamicFieldDisplay(field, values, access);
  if (display.kind === "empty" || display.kind === "hidden") return null;
  if (display.kind === "link") {
    return (
      <a href={display.href} rel="noreferrer" target="_blank">
        {display.text}
      </a>
    );
  }
  if (display.kind === "masked" || display.kind === "text") {
    return <span>{display.text}</span>;
  }

  return null;
}
