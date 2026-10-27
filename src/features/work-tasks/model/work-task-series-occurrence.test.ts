import { describe, expect, it } from "vitest";

import { toWorkTaskSeriesOccurrence } from "./work-task-series-occurrence";

describe("toWorkTaskSeriesOccurrence", () => {
  it("keeps only a series-matched immutable occurrence fact", () => {
    expect(
      toWorkTaskSeriesOccurrence(
        {
          createdTime: "2026-07-26T09:00:00",
          generatedWorkTaskId: 21,
          id: 18,
          nominalLocalTime: "2026-08-01T09:30:00",
          occurrenceSequence: 3,
          resolvedDueTime: "2026-08-01T09:30:00",
          resolvedOffsetSeconds: 28800,
          safeReason: null,
          seriesGeneration: 1,
          seriesId: 9,
          status: "MATERIALIZED",
          zoneId: "Asia/Shanghai",
        },
        9,
      ),
    ).toEqual({
      occurrenceSequence: 3,
      resolvedDueTime: "2026-08-01T09:30:00",
      status: "MATERIALIZED",
    });
  });

  it("fails closed for another series, invalid facts, or unsafe dates", () => {
    expect(
      toWorkTaskSeriesOccurrence(
        {
          occurrenceSequence: 3,
          resolvedDueTime: "2026-08-01T09:30:00",
          seriesId: 8,
          status: "SKIPPED",
        },
        9,
      ),
    ).toBeNull();
    expect(
      toWorkTaskSeriesOccurrence(
        {
          occurrenceSequence: 3,
          resolvedDueTime: "2026-02-30T09:30:00",
          seriesId: 9,
          status: "SKIPPED",
        },
        9,
      ),
    ).toBeNull();
    expect(
      toWorkTaskSeriesOccurrence(
        {
          occurrenceSequence: 3,
          resolvedDueTime: "2026-08-01T09:30:00",
          seriesId: 9,
          status: "UNKNOWN",
        },
        9,
      ),
    ).toBeNull();
  });
});
