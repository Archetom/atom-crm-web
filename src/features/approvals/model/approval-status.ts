export const approvalInstanceStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  "CANCELLED",
] as const;

export type ApprovalInstanceStatus = (typeof approvalInstanceStatuses)[number];

export const approvalStatusLabels: Readonly<Record<ApprovalInstanceStatus, string>> = {
  APPROVED: "已通过",
  CANCELLED: "已取消",
  PENDING: "审批中",
  REJECTED: "已驳回",
  WITHDRAWN: "已撤回",
};

export function toApprovalInstanceStatus(value: unknown): ApprovalInstanceStatus | null {
  return typeof value === "string" &&
    approvalInstanceStatuses.includes(value as ApprovalInstanceStatus)
    ? (value as ApprovalInstanceStatus)
    : null;
}
