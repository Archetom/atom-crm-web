import { describe, expect, it } from "vitest";

import { toApprovalPendingItem, toApprovalPendingPage } from "./approval-pending-item";

describe("approval pending projection", () => {
  it("keeps only the server-issued pending identity, capability, version, and optional title", () => {
    expect(
      toApprovalPendingItem({
        applicantActorId: 9,
        allowedActions: ["APPROVE", "REJECT", "APPROVE"],
        completedTime: null,
        currentStepOrder: 2,
        definitionId: 3,
        facts: { salary: ["100000"] },
        id: 8,
        objectType: "CUSTOMER",
        status: "PENDING",
        subjectId: 7,
        title: "审批客户折扣",
        updatedTime: "2026-07-26T10:00:00",
        version: 5,
      }),
    ).toEqual({
      allowedActions: ["APPROVE", "REJECT"],
      id: 8,
      status: "PENDING",
      title: "审批客户折扣",
      version: 5,
    });
    expect(
      toApprovalPendingItem({
        allowedActions: [],
        id: 9,
        status: "PENDING",
        title: null,
        version: 0,
      }),
    ).toEqual({ allowedActions: [], id: 9, status: "PENDING", title: null, version: 0 });
  });

  it("fails closed for non-pending or malformed facts and drops malformed page entries", () => {
    expect(
      toApprovalPendingItem({
        allowedActions: [],
        id: 8,
        status: "APPROVED",
        title: "审批客户折扣",
        version: 0,
      }),
    ).toBeNull();
    expect(
      toApprovalPendingItem({
        allowedActions: [],
        id: 0,
        status: "PENDING",
        title: "审批客户折扣",
        version: 0,
      }),
    ).toBeNull();
    expect(
      toApprovalPendingPage({
        objectList: [
          {
            allowedActions: ["APPROVE"],
            id: 8,
            status: "PENDING",
            title: "审批客户折扣",
            version: 2,
          },
          { allowedActions: [], id: 9, status: "REJECTED", title: "不应展示", version: 2 },
        ],
        totalNum: 2,
      }),
    ).toEqual({
      items: [
        {
          allowedActions: ["APPROVE"],
          id: 8,
          status: "PENDING",
          title: "审批客户折扣",
          version: 2,
        },
      ],
      total: 2,
    });
    expect(toApprovalPendingPage({ objectList: [], totalNum: "2" })).toBeNull();
  });
});
