import { recordOf } from "~/shared/utils/decode";

export interface OpportunityProductSnapshotLine {
  productId: number;
  productName: string;
  productCode: string | null;
  categoryName: string | null;
  unit: string | null;
  quantity: string | null;
}

export interface OpportunityProductSnapshot {
  version: number;
  lines: readonly OpportunityProductSnapshotLine[];
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function quantityText(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

/**
 * Narrow, money-free product projection while the success response remains
 * untyped. Prices, discounts, line amounts, and totals never enter the UI.
 */
export function toOpportunityProductSnapshot(value: unknown): OpportunityProductSnapshot | null {
  const source = recordOf(value);
  if (source === null || !Array.isArray(source.lines)) return null;
  const version =
    typeof source.version === "number" &&
    Number.isSafeInteger(source.version) &&
    source.version >= 0
      ? source.version
      : null;
  if (version === null) return null;

  const lines: OpportunityProductSnapshotLine[] = [];
  for (const value of source.lines) {
    const line = recordOf(value);
    if (line === null) return null;
    const productId = line.productId;
    const productName = optionalText(line.productName);
    if (
      typeof productId !== "number" ||
      !Number.isSafeInteger(productId) ||
      productId <= 0 ||
      productName === null
    ) {
      return null;
    }
    lines.push({
      productId,
      productName,
      productCode: optionalText(line.productCode),
      categoryName: optionalText(line.categoryName),
      unit: optionalText(line.unit),
      quantity: quantityText(line.quantity),
    });
  }

  return { lines, version };
}
