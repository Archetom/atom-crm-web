import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import { reportQueryFromSearchParams, withReportQuerySearchParams } from "./report-query";

describe("reportQueryFromSearchParams", () => {
  it("uses only generated metric/granularity enums and a complete ordered date range", () => {
    expect(
      reportQueryFromSearchParams(
        new URLSearchParams({
          reportFrom: "2026-08-01",
          reportGranularity: "WEEK",
          reportMetric: "ACTIVE_CONTRACT",
          reportTo: "2026-08-10",
        }),
        dayjs("2026-08-10"),
      ),
    ).toEqual({
      from: "2026-08-01",
      granularity: "WEEK",
      metric: "ACTIVE_CONTRACT",
      to: "2026-08-10",
    });
  });

  it("falls back as a whole when the URL supplies unsupported enums or an invalid range", () => {
    expect(
      reportQueryFromSearchParams(
        new URLSearchParams({
          reportFrom: "2026-08-11",
          reportGranularity: "YEAR",
          reportMetric: "UNPUBLISHED",
          reportTo: "2026-08-10",
        }),
        dayjs("2026-08-10"),
      ),
    ).toEqual({
      from: "2026-07-12",
      granularity: "DAY",
      metric: "WON_OPPORTUNITY",
      to: "2026-08-10",
    });
  });
});

describe("withReportQuerySearchParams", () => {
  it("keeps report-definition pagination while writing the fixed report query", () => {
    expect(
      withReportQuerySearchParams(
        new URLSearchParams({ definitionPage: "3", definitionSize: "50" }),
        {
          from: "2026-08-01",
          granularity: "MONTH",
          metric: "ACTIVE_RECEIVABLE",
          to: "2026-08-10",
        },
      ).toString(),
    ).toBe(
      "definitionPage=3&definitionSize=50&reportFrom=2026-08-01&reportGranularity=MONTH&reportMetric=ACTIVE_RECEIVABLE&reportTo=2026-08-10",
    );
  });
});
