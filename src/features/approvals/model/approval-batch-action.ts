import { positiveInteger, recordOf } from "~/shared/utils/decode";

export const approvalBatchActionStatuses = ["APPLIED", "NOT_APPLIED", "REJECTED"] as const;
export const approvalBatchErrorCodes = [
  "NONE",
  "VERSION_CONFLICT",
  "APPROVAL_ACTION_NOT_ALLOWED",
  "TRANSFER_TARGET_INVALID",
  "BATCH_ABORTED",
] as const;

export type ApprovalBatchActionStatus = (typeof approvalBatchActionStatuses)[number];
export type ApprovalBatchErrorCode = (typeof approvalBatchErrorCodes)[number];

export interface ApprovalBatchActionItem {
  errCode: ApprovalBatchErrorCode;
  instanceId: number;
  status: ApprovalBatchActionStatus;
  version: number | null;
}

export interface ApprovalBatchActionResult {
  applied: boolean;
  atomic: true;
  items: ApprovalBatchActionItem[];
}

function nonNegativeInteger(value: unknown): number | null | undefined {
  if (value === undefined) return null;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

export function toApprovalBatchActionItem(value: unknown): ApprovalBatchActionItem | null {
  const source = recordOf(value);
  const instanceId = source === null ? null : positiveInteger(source.instanceId);
  const version = source === null ? undefined : nonNegativeInteger(source.version);
  if (
    source === null ||
    instanceId === null ||
    version === undefined ||
    !isOneOf(source.status, approvalBatchActionStatuses) ||
    !isOneOf(source.errCode, approvalBatchErrorCodes)
  ) {
    return null;
  }

  return { errCode: source.errCode, instanceId, status: source.status, version };
}

/** Decodes the server's all-or-nothing batch result before it can affect client cache state. */
export function toApprovalBatchActionResult(value: unknown): ApprovalBatchActionResult | null {
  const source = recordOf(value);
  if (source === null || source.atomic !== true || typeof source.applied !== "boolean") return null;
  if (!Array.isArray(source.items)) return null;

  const items: ApprovalBatchActionItem[] = [];
  for (const value of source.items) {
    const item = toApprovalBatchActionItem(value);
    if (item === null) return null;
    items.push(item);
  }

  return { applied: source.applied, atomic: true, items };
}
