import { describe, expect, it } from "vitest";

import { toStageWorkflowDefinitionDetail } from "./stage-workflow-detail";

describe("stage workflow definition detail projection", () => {
  it("keeps renderable stages without actor scopes, codes, actions, or approval IDs", () => {
    expect(
      toStageWorkflowDefinitionDetail({
        allowedActions: ["UPDATE"],
        applicableActorIds: [9],
        applicableDepartmentIds: [3],
        failureName: "未完成",
        id: 8,
        name: "客户资格确认",
        objectType: "CUSTOMER",
        stages: [
          {
            approvalDefinitionId: 18,
            code: "qualification",
            name: "资格确认",
            order: 1,
            probability: 20,
            requiredFieldCodes: ["industry"],
            tasks: [
              { code: "verify-owner", name: "确认负责人", required: true },
              { code: "write-note", name: "补充说明", required: false },
            ],
          },
        ],
        status: "INACTIVE",
        successName: "已完成",
        version: 4,
      }),
    ).toEqual({
      failureName: "未完成",
      id: 8,
      name: "客户资格确认",
      objectType: "CUSTOMER",
      stages: [
        {
          hasApprovalGate: true,
          name: "资格确认",
          order: 1,
          probability: 20,
          requiredFieldCodes: ["industry"],
          tasks: [
            { name: "确认负责人", required: true },
            { name: "补充说明", required: false },
          ],
        },
      ],
      successName: "已完成",
      version: 4,
    });
  });

  it("fails closed when a required stage baseline is incomplete", () => {
    expect(
      toStageWorkflowDefinitionDetail({
        failureName: "未完成",
        id: 8,
        name: "客户资格确认",
        objectType: "CUSTOMER",
        stages: [
          {
            name: "资格确认",
            order: 1,
            probability: 20,
            requiredFieldCodes: ["industry"],
          },
        ],
        successName: "已完成",
        version: 4,
      }),
    ).toBeNull();
  });
});
