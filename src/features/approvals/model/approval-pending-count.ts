import { recordOf } from "~/shared/utils/decode";

/** Keeps only a non-sensitive, server-authorized pending approval total. */
export function toApprovalPendingCount(value: unknown): number | null {
  const source = recordOf(value);
  const count = source?.count;
  return typeof count === "number" && Number.isSafeInteger(count) && count >= 0 ? count : null;
}
