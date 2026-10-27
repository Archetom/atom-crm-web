import { describe, expect, it } from "vitest";

import { toApprovalBatchActionItem, toApprovalBatchActionResult } from "./approval-batch-action";

describe("approval batch action result projection", () => {
  it("keeps the typed all-or-nothing result", () => {
    expect(
      toApprovalBatchActionResult({
        applied: true,
        atomic: true,
        items: [{ errCode: "NONE", instanceId: 8, status: "APPLIED", version: 4 }],
      }),
    ).toEqual({
      applied: true,
      atomic: true,
      items: [{ errCode: "NONE", instanceId: 8, status: "APPLIED", version: 4 }],
    });
  });

  it("fails closed for a non-atomic response or unknown item facts", () => {
    expect(
      toApprovalBatchActionResult({
        applied: false,
        atomic: false,
        items: [{ errCode: "BATCH_ABORTED", instanceId: 8, status: "NOT_APPLIED" }],
      }),
    ).toBeNull();
    expect(
      toApprovalBatchActionItem({
        errCode: "RAW_SERVER_MESSAGE",
        instanceId: 8,
        status: "REJECTED",
      }),
    ).toBeNull();
  });
});
