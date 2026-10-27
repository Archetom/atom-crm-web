import { describe, expect, it } from "vitest";

import { toStageWorkflowSummary, toStageWorkflowSummaryPage } from "./stage-workflow-summary";

describe("stage workflow directory projection", () => {
  it("keeps only the safe workflow directory fields", () => {
    expect(
      toStageWorkflowSummary({
        allowedActions: ["UPDATE", "ACTIVATE"],
        applicableActorIds: [8],
        applicableDepartmentIds: [3],
        createdTime: "2026-07-28T10:00:00",
        id: 9,
        name: "客户资格确认",
        objectType: "CUSTOMER",
        stages: [{ code: "qualify", requiredFieldCodes: ["industry"] }],
        status: "INACTIVE",
        version: 2,
      }),
    ).toEqual({ id: 9, name: "客户资格确认", objectType: "CUSTOMER", version: 2 });
  });

  it("fails closed for malformed workflow fields and drops malformed list entries", () => {
    expect(
      toStageWorkflowSummary({ id: 9, name: "客户资格确认", objectType: "CUSTOMER", version: -1 }),
    ).toBeNull();
    expect(
      toStageWorkflowSummaryPage({
        objectList: [
          { id: 9, name: "客户资格确认", objectType: "CUSTOMER", version: 2 },
          { id: 10, name: "", objectType: "CUSTOMER", version: 2 },
        ],
        totalNum: 2,
      }),
    ).toEqual({
      items: [{ id: 9, name: "客户资格确认", objectType: "CUSTOMER", version: 2 }],
      total: 2,
    });
    expect(toStageWorkflowSummaryPage({ objectList: [], totalNum: "2" })).toBeNull();
  });
});
