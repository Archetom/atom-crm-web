import { describe, expect, it } from "vitest";

import { toOpportunitySummary } from "./opportunity-summary";

describe("toOpportunitySummary", () => {
  it("retains a server-authorized count and estimated amount", () => {
    expect(toOpportunitySummary({ count: 3, estimatedAmount: 1250.5 })).toEqual({
      count: 3,
      estimatedAmount: 1250.5,
    });
  });

  it("fails closed for missing, unsafe, negative, or non-finite aggregate values", () => {
    expect(toOpportunitySummary({ count: 1 })).toBeNull();
    expect(toOpportunitySummary({ count: -1, estimatedAmount: 1 })).toBeNull();
    expect(toOpportunitySummary({ count: 1.5, estimatedAmount: 1 })).toBeNull();
    expect(toOpportunitySummary({ count: 1, estimatedAmount: -1 })).toBeNull();
    expect(
      toOpportunitySummary({ count: 1, estimatedAmount: Number.POSITIVE_INFINITY }),
    ).toBeNull();
  });
});
