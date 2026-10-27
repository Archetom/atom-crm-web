import { describe, expect, it } from "vitest";

import {
  toApprovalTransferCandidate,
  toApprovalTransferCandidatePage,
} from "./approval-transfer-candidate";

describe("approval transfer candidate projection", () => {
  it("keeps only server-validated transfer candidates", () => {
    expect(
      toApprovalTransferCandidate({
        actorId: 8,
        displayName: "李莉",
        membershipStatus: "ACTIVE",
        roleIds: [2],
      }),
    ).toEqual({ actorId: 8, displayName: "李莉" });
  });

  it("fails closed when a candidate page contains malformed data", () => {
    expect(
      toApprovalTransferCandidatePage({
        objectList: [{ actorId: 8, displayName: "李莉" }],
        totalNum: 1,
      }),
    ).toEqual({ candidates: [{ actorId: 8, displayName: "李莉" }], total: 1 });
    expect(
      toApprovalTransferCandidatePage({
        objectList: [{ actorId: 8, displayName: "" }],
        totalNum: 1,
      }),
    ).toBeNull();
  });
});
