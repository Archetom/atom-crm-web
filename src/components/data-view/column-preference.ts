import type { FieldLayout } from "~/components/dynamic-field";

export interface ColumnPreferenceOption {
  code: string;
  label: string;
}

export interface FieldLayoutUpdate {
  columnWidths: Record<string, number>;
  hiddenCodes: string[];
  orderedCodes: string[];
  pinnedCodes: string[];
  version?: number;
}

function uniqueCodes(options: readonly ColumnPreferenceOption[]): string[] {
  return [...new Set(options.map((option) => option.code))];
}

/** Returns the caller's visible columns in server-persisted presentation order. */
export function visibleColumnCodes(
  options: readonly ColumnPreferenceOption[],
  layout: FieldLayout | undefined,
): string[] {
  const codes = uniqueCodes(options);
  const order = new Map((layout?.orderedCodes ?? []).map((code, index) => [code, index]));
  const hidden = new Set(layout?.hiddenCodes ?? []);

  return codes
    .filter((code) => !hidden.has(code))
    .sort((left, right) => {
      const leftOrder = order.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = order.get(right) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return codes.indexOf(left) - codes.indexOf(right);
    });
}

/** Merges list-only visibility choices without discarding field preferences used by other surfaces. */
export function fieldLayoutUpdateForColumns(
  layout: FieldLayout,
  options: readonly ColumnPreferenceOption[],
  visibleCodes: readonly string[],
): FieldLayoutUpdate {
  const managedCodes = new Set(uniqueCodes(options));
  const visible = new Set(visibleCodes.filter((code) => managedCodes.has(code)));
  const unchangedHidden = layout.hiddenCodes.filter((code) => !managedCodes.has(code));

  return {
    columnWidths: { ...layout.columnWidths },
    hiddenCodes: [
      ...new Set([...unchangedHidden, ...[...managedCodes].filter((code) => !visible.has(code))]),
    ],
    orderedCodes: [...layout.orderedCodes],
    pinnedCodes: [...layout.pinnedCodes],
    ...(layout.version === null ? {} : { version: layout.version }),
  };
}
