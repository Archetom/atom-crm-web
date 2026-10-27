import { describe, expect, it } from "vitest";

import {
  performanceTargetRouteQueryFromSearchParams,
  withPerformanceTargetRouteQuery,
} from "./performance-target-route";

describe("performanceTargetRouteQueryFromSearchParams", () => {
  it("accepts only safe positive member IDs and calendar years", () => {
    expect(
      performanceTargetRouteQueryFromSearchParams(
        new URLSearchParams({
          departmentId: "18",
          memberId: "17",
          targetScope: "DEPARTMENT",
          targetYear: "2026",
        }),
        2025,
      ),
    ).toEqual({ departmentId: 18, memberId: 17, targetScope: "DEPARTMENT", targetYear: 2026 });
    expect(
      performanceTargetRouteQueryFromSearchParams(
        new URLSearchParams({
          departmentId: "-2",
          memberId: "-1",
          targetScope: "OTHER",
          targetYear: "12000",
        }),
        2025,
      ),
    ).toEqual({ departmentId: null, memberId: null, targetScope: "MEMBER", targetYear: 2025 });
  });

  it("updates target dimensions without discarding unrelated route state", () => {
    expect(
      withPerformanceTargetRouteQuery(
        new URLSearchParams({
          departmentId: "6",
          memberId: "7",
          panel: "history",
          targetYear: "2025",
        }),
        { departmentId: 9, memberId: 8, targetScope: "DEPARTMENT", targetYear: 2026 },
      ).toString(),
    ).toBe("departmentId=9&memberId=8&panel=history&targetYear=2026&targetScope=DEPARTMENT");
  });
});
