import { describe, expect, it } from "vitest";

import { approvalStatusLabels, toApprovalInstanceStatus } from "./approval-status";

describe("approval status projection", () => {
  it("keeps only closed approval instance status values", () => {
    expect(toApprovalInstanceStatus("PENDING")).toBe("PENDING");
    expect(toApprovalInstanceStatus("APPROVED")).toBe("APPROVED");
    expect(toApprovalInstanceStatus("ACTIVE")).toBeNull();
    expect(toApprovalInstanceStatus({ status: "PENDING" })).toBeNull();
  });

  it("uses reviewed Chinese labels for every projected state", () => {
    expect(approvalStatusLabels).toEqual({
      APPROVED: "已通过",
      CANCELLED: "已取消",
      PENDING: "审批中",
      REJECTED: "已驳回",
      WITHDRAWN: "已撤回",
    });
  });
});
