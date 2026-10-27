import { recordOf } from "~/shared/utils/decode";

export interface OpportunitySummary {
  count: number;
  estimatedAmount: number;
}

function isSafeNonNegativeAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Accepts the aggregate only when both field-authorized server values are safe. */
export function toOpportunitySummary(value: unknown): OpportunitySummary | null {
  const source = recordOf(value);
  if (
    source === null ||
    !isSafeNonNegativeInteger(source.count) ||
    !isSafeNonNegativeAmount(source.estimatedAmount)
  ) {
    return null;
  }

  return { count: source.count, estimatedAmount: source.estimatedAmount };
}
