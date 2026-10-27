import { describe, expect, it } from "vitest";

import {
  MAX_PERFORMANCE_TARGET_IMPORT_ROWS,
  parsePerformanceTargetImportCsv,
  performanceTargetImportTemplate,
} from "./performance-target-import";

describe("performance target CSV import parsing", () => {
  it("returns a generated member import request without retaining source metadata", () => {
    expect(
      parsePerformanceTargetImportCsv(
        "MEMBER",
        "\uFEFFmemberId,targetYear,targetMonth,amount\n7,2026,8,80000.50\n",
      ),
    ).toEqual({
      request: {
        metric: "ACTIVE_CONTRACT",
        targets: [{ amount: 80000.5, memberId: 7, targetMonth: 8, targetYear: 2026 }],
      },
      scope: "MEMBER",
    });
  });

  it("returns only valid department year, quarter, and month rows", () => {
    expect(
      parsePerformanceTargetImportCsv(
        "DEPARTMENT",
        [
          "departmentId,targetYear,period,periodNumber,amount",
          "8,2026,YEAR,1,1200000",
          "8,2026,QUARTER,4,300000",
          "8,2026,MONTH,12,100000",
        ].join("\n"),
      ),
    ).toEqual({
      request: {
        metric: "ACTIVE_CONTRACT",
        targets: [
          { amount: 1200000, departmentId: 8, period: "YEAR", periodNumber: 1, targetYear: 2026 },
          {
            amount: 300000,
            departmentId: 8,
            period: "QUARTER",
            periodNumber: 4,
            targetYear: 2026,
          },
          {
            amount: 100000,
            departmentId: 8,
            period: "MONTH",
            periodNumber: 12,
            targetYear: 2026,
          },
        ],
      },
      scope: "DEPARTMENT",
    });
  });

  it("rejects malformed, duplicate, and unbounded rows before any request is made", () => {
    expect(() =>
      parsePerformanceTargetImportCsv(
        "MEMBER",
        "memberId,targetYear,targetMonth,amount\n7,2026,13,1",
      ),
    ).toThrow("目标月份必须在 1 到 12 之间");
    expect(() =>
      parsePerformanceTargetImportCsv(
        "MEMBER",
        "memberId,targetYear,targetMonth,amount\n7,2026,8,1\n7,2026,8,2",
      ),
    ).toThrow("不可包含重复");
    const rows = Array.from(
      { length: MAX_PERFORMANCE_TARGET_IMPORT_ROWS + 1 },
      (_, index) => `7,2026,${(index % 12) + 1},1`,
    );
    expect(() =>
      parsePerformanceTargetImportCsv(
        "MEMBER",
        ["memberId,targetYear,targetMonth,amount", ...rows].join("\n"),
      ),
    ).toThrow(`一次最多导入 ${MAX_PERFORMANCE_TARGET_IMPORT_ROWS} 条`);
    expect(() =>
      parsePerformanceTargetImportCsv(
        "MEMBER",
        'memberId,targetYear,targetMonth,amount\n"7,2026,8,1',
      ),
    ).toThrow("未闭合的引号");
  });

  it("publishes an exact scope-specific template", () => {
    expect(performanceTargetImportTemplate("MEMBER")).toBe(
      "memberId,targetYear,targetMonth,amount\n1001,2026,1,100000.00\n",
    );
    expect(performanceTargetImportTemplate("DEPARTMENT")).toBe(
      "departmentId,targetYear,period,periodNumber,amount\n10,2026,YEAR,1,1200000.00\n",
    );
  });
});
