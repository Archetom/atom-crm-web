import { describe, expect, it } from "vitest";

import {
  toApprovalDefinitionEditableBaseline,
  toApprovalDefinitionUpdateRequest,
} from "./approval-definition-edit";

describe("minimal approval definition editor", () => {
  const response = {
    id: 8,
    initiatorActorIds: [],
    initiatorDepartmentIds: [],
    managerActorIds: [10],
    name: "客户折扣审批",
    objectType: "CUSTOMER",
    repeatMode: "ONCE",
    status: "INACTIVE",
    steps: [
      {
        code: "step-1",
        conditions: [],
        fallback: "MANAGERS",
        memberActorIds: [8, 9],
        mode: "ANY",
        name: "审批成员",
        order: 0,
        roleIds: [],
        type: "MEMBER",
      },
    ],
    version: 3,
  };

  it("accepts only the reviewed inactive single-member-step baseline", () => {
    expect(toApprovalDefinitionEditableBaseline({ ...response, description: "不应保留" })).toEqual({
      approverActorIds: [8, 9],
      id: 8,
      managerActorIds: [10],
      name: "客户折扣审批",
      objectType: "CUSTOMER",
      stepMode: "ANY",
      stepName: "审批成员",
      version: 3,
    });
    expect(
      toApprovalDefinitionEditableBaseline({
        ...response,
        steps: [{ ...response.steps[0], conditions: [{ fieldCode: "discount" }] }],
      }),
    ).toBeNull();
    expect(toApprovalDefinitionEditableBaseline({ ...response, status: "ACTIVE" })).toBeNull();
  });

  it("uses the verified baseline to build the only supported replacement payload", () => {
    const baseline = toApprovalDefinitionEditableBaseline(response);
    expect(baseline).not.toBeNull();
    expect(
      toApprovalDefinitionUpdateRequest(baseline!, {
        approverActorIds: [9],
        managerActorIds: [10],
        name: "  更新后的审批  ",
        stepMode: "ALL",
      }),
    ).toEqual({
      managerActorIds: [10],
      name: "更新后的审批",
      objectType: "CUSTOMER",
      repeatMode: "ONCE",
      steps: [
        {
          code: "step-1",
          fallback: "MANAGERS",
          memberActorIds: [9],
          mode: "ALL",
          name: "审批成员",
          order: 0,
          type: "MEMBER",
        },
      ],
      version: 3,
    });
  });
});
