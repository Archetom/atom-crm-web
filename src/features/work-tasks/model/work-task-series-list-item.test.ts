import { describe, expect, it } from "vitest";

import { toWorkTaskSeriesListItem } from "./work-task-series-list-item";

function listItem(overrides: Record<string, unknown> = {}) {
  return {
    actionBlockers: [],
    allowedActions: ["UPDATE", "PAUSE"],
    id: 11,
    recurrence: {
      endLocalDate: "2026-12-31",
      frequency: "WEEKLY",
      interval: 2,
      lastDayOfMonth: false,
      localTime: "09:30:00",
      monthDay: null,
      startLocalDate: "2026-07-26",
      weekdays: ["WEDNESDAY", "MONDAY"],
      zoneId: "Asia/Shanghai",
    },
    status: "ACTIVE",
    title: "每两周回顾",
    version: 3,
    ...overrides,
  };
}

describe("toWorkTaskSeriesListItem", () => {
  it("keeps only the visible recurrence rule and server-issued capabilities", () => {
    expect(
      toWorkTaskSeriesListItem(
        listItem({
          createdByActorId: 8,
          description: "不进入浏览缓存",
          followerActorIds: [10],
          nextDueTime: "2026-07-27T01:30:00",
        }),
      ),
    ).toEqual({
      actionBlockers: undefined,
      allowedActions: ["UPDATE", "PAUSE"],
      endLocalDate: "2026-12-31",
      frequency: "WEEKLY",
      id: 11,
      interval: 2,
      lastDayOfMonth: false,
      localTime: "09:30:00",
      monthDay: null,
      startLocalDate: "2026-07-26",
      status: "ACTIVE",
      title: "每两周回顾",
      version: 3,
      weekdays: ["MONDAY", "WEDNESDAY"],
      zoneId: "Asia/Shanghai",
    });
  });

  it("fails closed when the server omits resource capabilities or returns an invalid recurrence", () => {
    expect(toWorkTaskSeriesListItem(listItem({ allowedActions: undefined }))).toBeNull();
    expect(toWorkTaskSeriesListItem(listItem({ actionBlockers: ["UNKNOWN"] }))).toBeNull();
    expect(
      toWorkTaskSeriesListItem(
        listItem({ recurrence: { ...listItem().recurrence, weekdays: [] } }),
      ),
    ).toBeNull();
    expect(
      toWorkTaskSeriesListItem(
        listItem({ recurrence: { ...listItem().recurrence, frequency: "MONTHLY", monthDay: 31 } }),
      ),
    ).toBeNull();
  });

  it("accepts an unbounded draft recurrence with an empty capability list", () => {
    expect(
      toWorkTaskSeriesListItem(
        listItem({
          allowedActions: [],
          recurrence: { ...listItem().recurrence, endLocalDate: null, weekdays: ["MONDAY"] },
          status: "DRAFT",
          version: 0,
        }),
      ),
    ).toMatchObject({
      allowedActions: [],
      endLocalDate: null,
      frequency: "WEEKLY",
      id: 11,
      status: "DRAFT",
    });
  });

  it("fails closed for invalid calendar data", () => {
    expect(
      toWorkTaskSeriesListItem(
        listItem({
          recurrence: {
            ...listItem().recurrence,
            frequency: "DAILY",
            localTime: "24:00:00",
            startLocalDate: "2026-02-31",
            weekdays: [],
            zoneId: "not-a-timezone",
          },
        }),
      ),
    ).toBeNull();
  });
});
