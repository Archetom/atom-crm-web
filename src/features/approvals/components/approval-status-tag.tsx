import { Tag } from "antd";

import { approvalStatusLabels, type ApprovalInstanceStatus } from "../model/approval-status";

interface ApprovalStatusTagProps {
  status: ApprovalInstanceStatus | null;
}

const statusColors: Readonly<Record<ApprovalInstanceStatus, string>> = {
  APPROVED: "success",
  CANCELLED: "default",
  PENDING: "processing",
  REJECTED: "error",
  WITHDRAWN: "default",
};

/** Presents only the latest server-projected approval instance status for an already-visible record. */
export function ApprovalStatusTag({ status }: Readonly<ApprovalStatusTagProps>) {
  return status === null ? (
    "未发起"
  ) : (
    <Tag color={statusColors[status]}>{approvalStatusLabels[status]}</Tag>
  );
}
