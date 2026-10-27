import { approvalInstanceStatuses, type ApprovalInstanceStatus } from "./approval-status";
import { positiveInteger, recordOf } from "~/shared/utils/decode";

export { approvalInstanceStatuses } from "./approval-status";
export type { ApprovalInstanceStatus } from "./approval-status";
export const approvalTimelineTaskStatuses = [
  "WAITING",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "TRANSFERRED",
  "SKIPPED",
] as const;
export const approvalInstanceActions = [
  "APPROVE",
  "REJECT",
  "TRANSFER",
  "WITHDRAW",
  "CANCEL",
] as const;

export type ApprovalTimelineTaskStatus = (typeof approvalTimelineTaskStatuses)[number];
export type ApprovalInstanceAction = (typeof approvalInstanceActions)[number];

export interface ApprovalTimelineItem {
  actedTime: string | null;
  status: ApprovalTimelineTaskStatus;
  stepName: string;
  stepOrder: number;
}

export interface ApprovalPendingDetail {
  allowedActions: ApprovalInstanceAction[];
  id: number;
  status: ApprovalInstanceStatus;
  tasks: ApprovalTimelineItem[];
  title: string | null;
  version: number;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function localDateTime(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?$/.exec(value);
  if (match === null) return undefined;

  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day &&
    parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute &&
    parsed.getUTCSeconds() === second
    ? value
    : undefined;
}

/** Drops task keys, assignees, remarks, modes, facts, business references, and instance lifecycle. */
export function toApprovalTimelineItem(value: unknown): ApprovalTimelineItem | null {
  const source = recordOf(value);
  const stepOrder = source === null ? null : positiveInteger(source.stepOrder);
  const actedTime = source === null ? undefined : localDateTime(source.actedTime);
  if (
    source === null ||
    stepOrder === null ||
    actedTime === undefined ||
    typeof source.stepName !== "string" ||
    source.stepName.trim().length === 0 ||
    !isOneOf(source.status, approvalTimelineTaskStatuses)
  ) {
    return null;
  }

  return { actedTime, status: source.status, stepName: source.stepName, stepOrder };
}

/** Decodes a server-visible approval detail before it enters the client-side server-data cache. */
export function toApprovalPendingDetail(value: unknown): ApprovalPendingDetail | null {
  const source = recordOf(value);
  const id = source === null ? null : positiveInteger(source.id);
  const title = source === null ? undefined : source.title;
  const version = source === null ? null : nonNegativeInteger(source.version);
  const allowedActions =
    source === null || !Array.isArray(source.allowedActions)
      ? null
      : source.allowedActions.every((action) => isOneOf(action, approvalInstanceActions))
        ? [...new Set(source.allowedActions)]
        : null;
  if (
    source === null ||
    id === null ||
    version === null ||
    allowedActions === null ||
    !Array.isArray(source.tasks) ||
    (title !== null && (typeof title !== "string" || title.trim().length === 0)) ||
    !isOneOf(source.status, approvalInstanceStatuses)
  ) {
    return null;
  }

  return {
    allowedActions,
    id,
    status: source.status,
    tasks: source.tasks.flatMap((task) => {
      const timeline = toApprovalTimelineItem(task);
      return timeline === null ? [] : [timeline];
    }),
    title,
    version,
  };
}

/** Decodes a narrow action result and drops every field outside the safe instance projection. */
export function toApprovalActionResult(value: unknown): ApprovalPendingDetail | null {
  const source = recordOf(value);
  return source === null ? null : toApprovalPendingDetail(source.instance);
}
