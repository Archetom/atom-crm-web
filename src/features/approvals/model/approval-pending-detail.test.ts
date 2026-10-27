import { describe, expect, it } from "vitest";

import {
  toApprovalActionResult,
  toApprovalPendingDetail,
  toApprovalTimelineItem,
} from "./approval-pending-detail";

describe("approval pending detail projection", () => {
  it("keeps only the instance status and a task timeline without actor or fact data", () => {
    expect(
      toApprovalPendingDetail({
        applicantActorId: 9,
        allowedActions: ["APPROVE", "TRANSFER", "APPROVE"],
        currentStepOrder: 2,
        facts: { discount: ["80"] },
        fileFields: { contract: [{ id: 7 }] },
        id: 8,
        objectType: "CUSTOMER",
        status: "PENDING",
        subjectId: 6,
        tasks: [
          {
            actedTime: "2026-07-26T10:00:00",
            assignedActorId: 10,
            mode: "SEQUENTIAL",
            remark: "不应缓存",
            sourceTaskKey: "source-1",
            status: "APPROVED",
            stepName: "直属负责人",
            stepOrder: 1,
            taskKey: "task-1",
          },
        ],
        title: "审批客户折扣",
        version: 3,
        watcherActorIds: [11],
      }),
    ).toEqual({
      allowedActions: ["APPROVE", "TRANSFER"],
      id: 8,
      status: "PENDING",
      tasks: [
        {
          actedTime: "2026-07-26T10:00:00",
          status: "APPROVED",
          stepName: "直属负责人",
          stepOrder: 1,
        },
      ],
      title: "审批客户折扣",
      version: 3,
    });
  });

  it("fails closed for malformed detail facts and drops malformed timeline entries", () => {
    expect(
      toApprovalTimelineItem({
        actedTime: "2026-02-30T10:00:00",
        status: "APPROVED",
        stepName: "直属负责人",
        stepOrder: 1,
      }),
    ).toBeNull();
    expect(
      toApprovalPendingDetail({
        id: 8,
        allowedActions: [],
        status: "PENDING",
        tasks: [
          { actedTime: null, status: "WAITING", stepName: "财务", stepOrder: 2 },
          { actedTime: null, status: "UNKNOWN", stepName: "忽略", stepOrder: 3 },
        ],
        title: null,
        version: 0,
      }),
    ).toEqual({
      allowedActions: [],
      id: 8,
      status: "PENDING",
      tasks: [{ actedTime: null, status: "WAITING", stepName: "财务", stepOrder: 2 }],
      title: null,
      version: 0,
    });
    expect(
      toApprovalPendingDetail({
        allowedActions: [],
        id: 8,
        status: "UNKNOWN",
        tasks: [],
        title: "审批",
        version: 0,
      }),
    ).toBeNull();
  });

  it("keeps the typed action result projection and rejects malformed capabilities", () => {
    expect(
      toApprovalActionResult({
        instance: {
          allowedActions: ["WITHDRAW"],
          id: 8,
          status: "PENDING",
          tasks: [],
          title: "客户折扣审批",
          version: 4,
        },
      }),
    ).toMatchObject({ allowedActions: ["WITHDRAW"], id: 8, version: 4 });
    expect(
      toApprovalPendingDetail({
        allowedActions: ["IMPERSONATE"],
        id: 8,
        status: "PENDING",
        tasks: [],
        title: "客户折扣审批",
        version: 4,
      }),
    ).toBeNull();
  });
});
