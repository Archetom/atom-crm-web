import dayjs, { type Dayjs } from "dayjs";

import type { components } from "~/api/generated/schema";

export type ReportMetric = components["schemas"]["ReportTrendResponse"]["metric"];
export type ReportGranularity = components["schemas"]["ReportTrendResponse"]["granularity"];

export const reportMetrics = [
  "WON_OPPORTUNITY",
  "ACTIVE_CONTRACT",
  "ACTIVE_RECEIVABLE",
] as const satisfies readonly ReportMetric[];

export const reportGranularities = [
  "DAY",
  "WEEK",
  "MONTH",
] as const satisfies readonly ReportGranularity[];

export interface ReportQuery {
  from: string;
  granularity: ReportGranularity;
  metric: ReportMetric;
  to: string;
}

function isReportMetric(value: string | null): value is ReportMetric {
  return value !== null && reportMetrics.some((metric) => metric === value);
}

function isReportGranularity(value: string | null): value is ReportGranularity {
  return value !== null && reportGranularities.some((granularity) => granularity === value);
}

function isoDate(value: string | null): string | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = dayjs(value);
  return parsed.isValid() && parsed.format("YYYY-MM-DD") === value ? value : null;
}

/**
 * Keeps the fixed report controls constrained to the enums and calendar dates
 * published by the generated API. Malformed or inverted URL ranges fall back
 * as a pair so they never alter the server query unpredictably.
 */
export function reportQueryFromSearchParams(
  searchParams: URLSearchParams,
  now: Dayjs,
): ReportQuery {
  const defaultTo = now.format("YYYY-MM-DD");
  const defaultFrom = now.subtract(29, "day").format("YYYY-MM-DD");
  const requestedGranularity = searchParams.get("reportGranularity");
  const requestedMetric = searchParams.get("reportMetric");
  const requestedFrom = isoDate(searchParams.get("reportFrom"));
  const requestedTo = isoDate(searchParams.get("reportTo"));
  const hasValidRange =
    requestedFrom !== null &&
    requestedTo !== null &&
    !dayjs(requestedFrom).isAfter(dayjs(requestedTo), "day");

  return {
    from: hasValidRange ? requestedFrom : defaultFrom,
    granularity: isReportGranularity(requestedGranularity) ? requestedGranularity : "DAY",
    metric: isReportMetric(requestedMetric) ? requestedMetric : "WON_OPPORTUNITY",
    to: hasValidRange ? requestedTo : defaultTo,
  };
}

/** Preserves unrelated report-definition pagination when the fixed report query changes. */
export function withReportQuerySearchParams(
  searchParams: URLSearchParams,
  query: ReportQuery,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.set("reportFrom", query.from);
  next.set("reportGranularity", query.granularity);
  next.set("reportMetric", query.metric);
  next.set("reportTo", query.to);
  return next;
}
