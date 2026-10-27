import { describe, expect, it } from "vitest";

import { toApprovalDefinitionCreateRequest } from "./approval-definition-create";

describe("approval definition draft request", () => {
  it("creates only the reviewed single-member-step draft template", () => {
    expect(
      toApprovalDefinitionCreateRequest({
        approverActorIds: [8, 9],
        managerActorIds: [10],
        name: "  客户折扣审批  ",
        objectType: "CUSTOMER",
        stepMode: "ANY",
      }),
    ).toEqual({
      managerActorIds: [10],
      name: "客户折扣审批",
      objectType: "CUSTOMER",
      repeatMode: "ONCE",
      steps: [
        {
          code: "step-1",
          fallback: "MANAGERS",
          memberActorIds: [8, 9],
          mode: "ANY",
          name: "审批成员",
          order: 0,
          type: "MEMBER",
        },
      ],
    });
  });

  it("fails closed for invalid names, selections, modes, and object types", () => {
    const valid = {
      approverActorIds: [8],
      managerActorIds: [10],
      name: "客户折扣审批",
      objectType: "CUSTOMER" as const,
      stepMode: "ANY" as const,
    };
    expect(toApprovalDefinitionCreateRequest({ ...valid, approverActorIds: [8, 8] })).toBeNull();
    expect(toApprovalDefinitionCreateRequest({ ...valid, managerActorIds: [] })).toBeNull();
    expect(toApprovalDefinitionCreateRequest({ ...valid, name: " " })).toBeNull();
    expect(
      toApprovalDefinitionCreateRequest({ ...valid, objectType: "UNKNOWN" as "CUSTOMER" }),
    ).toBeNull();
    expect(
      toApprovalDefinitionCreateRequest({ ...valid, stepMode: "SEQUENTIAL" as "ANY" }),
    ).toBeNull();
  });
});
