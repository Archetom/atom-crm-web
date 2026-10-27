import { describe, expect, it } from "vitest";

import { toApprovalPendingCount } from "./approval-pending-count";

describe("toApprovalPendingCount", () => {
  it("accepts only a non-negative safe server count", () => {
    expect(toApprovalPendingCount({ count: 12 })).toBe(12);
    expect(toApprovalPendingCount({ count: 0 })).toBe(0);
  });

  it("fails closed for missing, fractional, negative, or unsafe counts", () => {
    expect(toApprovalPendingCount({})).toBeNull();
    expect(toApprovalPendingCount({ count: 1.5 })).toBeNull();
    expect(toApprovalPendingCount({ count: -1 })).toBeNull();
    expect(toApprovalPendingCount({ count: Number.MAX_SAFE_INTEGER + 1 })).toBeNull();
  });
});
