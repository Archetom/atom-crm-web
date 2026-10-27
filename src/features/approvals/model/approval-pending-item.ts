import { approvalInstanceActions, type ApprovalInstanceAction } from "./approval-pending-detail";
import { recordOf } from "~/shared/utils/decode";

export interface ApprovalPendingItem {
  allowedActions: ApprovalInstanceAction[];
  id: number;
  status: "PENDING";
  title: string | null;
  version: number;
}

export interface ApprovalPendingPage {
  items: ApprovalPendingItem[];
  total: number | null;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function pageTotal(value: unknown): number | null | undefined {
  if (value === -1) return null;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isApprovalInstanceAction(value: unknown): value is ApprovalInstanceAction {
  return (
    typeof value === "string" && (approvalInstanceActions as readonly string[]).includes(value)
  );
}

/** Drops approval facts, business references, applicant identity, and all timestamps. */
export function toApprovalPendingItem(value: unknown): ApprovalPendingItem | null {
  const source = recordOf(value);
  const id = source === null ? null : positiveIdentifier(source.id);
  const title = source === null ? undefined : source.title;
  const version = source === null ? null : nonNegativeInteger(source.version);
  const allowedActions =
    source === null || !Array.isArray(source.allowedActions)
      ? null
      : source.allowedActions.every((action): action is ApprovalInstanceAction =>
            isApprovalInstanceAction(action),
          )
        ? [...new Set(source.allowedActions)]
        : null;
  if (
    source === null ||
    id === null ||
    version === null ||
    allowedActions === null ||
    source.status !== "PENDING" ||
    (title !== null && (typeof title !== "string" || title.trim().length === 0))
  ) {
    return null;
  }

  return { allowedActions, id, status: "PENDING", title, version };
}

/** Decodes a pending-only pager before it enters the client-side server-data cache. */
export function toApprovalPendingPage(value: unknown): ApprovalPendingPage | null {
  const source = recordOf(value);
  const total = source === null ? undefined : pageTotal(source.totalNum);
  if (source === null || !Array.isArray(source.objectList) || total === undefined) return null;

  return {
    items: source.objectList.flatMap((item) => {
      const pending = toApprovalPendingItem(item);
      return pending === null ? [] : [pending];
    }),
    total,
  };
}
