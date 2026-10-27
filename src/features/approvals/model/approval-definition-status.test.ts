import { describe, expect, it } from "vitest";

import { toApprovalDefinitionStatusBaseline } from "./approval-definition-status";

describe("approval definition status baseline", () => {
  it("keeps only ID, status, and version from a definition response", () => {
    expect(
      toApprovalDefinitionStatusBaseline({
        description: "不应进入浏览器缓存",
        id: 8,
        initiatorActorIds: [9],
        managerActorIds: [10],
        name: "客户折扣审批",
        objectType: "CUSTOMER",
        status: "INACTIVE",
        steps: [{ conditions: [{ fieldCode: "discount", values: ["80"] }] }],
        updatedTime: "2026-07-26T10:00:00",
        version: 3,
      }),
    ).toEqual({ id: 8, status: "INACTIVE", version: 3 });
  });

  it("fails closed for invalid status-mutation baselines", () => {
    expect(
      toApprovalDefinitionStatusBaseline({ id: 8, status: "INACTIVE", version: -1 }),
    ).toBeNull();
    expect(toApprovalDefinitionStatusBaseline({ id: 8, status: "UNKNOWN", version: 3 })).toBeNull();
    expect(toApprovalDefinitionStatusBaseline({ id: 0, status: "ACTIVE", version: 3 })).toBeNull();
  });
});
