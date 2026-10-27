import { describe, expect, it } from "vitest";

import { toWorkTaskSeriesDetail, toWorkTaskSeriesMutationResult } from "./work-task-series-detail";

const recurrence = {
  endLocalDate: null,
  frequency: "WEEKLY",
  interval: 1,
  lastDayOfMonth: false,
  localTime: "09:00:00",
  monthDay: null,
  startLocalDate: "2026-08-01",
  weekdays: ["MONDAY"],
  zoneId: "Asia/Shanghai",
};

describe("Work task series typed detail", () => {
  it("retains the full baseline only with a complete server capability projection", () => {
    expect(
      toWorkTaskSeriesDetail({
        actionBlockers: ["SCHEDULER_UNAVAILABLE"],
        allowedActions: ["UPDATE", "ACTIVATE"],
        assigneeActorId: 7,
        description: "每周回访",
        followerActorIds: [8, 9],
        id: 5,
        priority: "HIGH",
        recurrence,
        status: "PAUSED",
        title: "客户回访",
        version: 3,
      }),
    ).toEqual({
      actionBlockers: undefined,
      allowedActions: ["UPDATE", "ACTIVATE"],
      assigneeActorId: 7,
      description: "每周回访",
      endLocalDate: null,
      followerActorIds: [8, 9],
      frequency: "WEEKLY",
      id: 5,
      interval: 1,
      lastDayOfMonth: false,
      localTime: "09:00:00",
      monthDay: null,
      priority: "HIGH",
      startLocalDate: "2026-08-01",
      status: "PAUSED",
      title: "客户回访",
      version: 3,
      weekdays: ["MONDAY"],
      zoneId: "Asia/Shanghai",
    });
  });

  it("rejects incomplete detail and mutation responses", () => {
    expect(
      toWorkTaskSeriesDetail({
        actionBlockers: [],
        allowedActions: ["UPDATE"],
        assigneeActorId: 7,
        description: "每周回访",
        followerActorIds: [8, 8],
        id: 5,
        priority: "HIGH",
        recurrence,
        status: "PAUSED",
        title: "客户回访",
        version: 3,
      }),
    ).toBeNull();
    expect(
      toWorkTaskSeriesMutationResult({
        allowedActions: ["ACTIVATE"],
        id: 5,
        status: "UNKNOWN",
        version: 4,
      }),
    ).toBeNull();
  });

  it("decodes typed mutation result capabilities", () => {
    expect(
      toWorkTaskSeriesMutationResult({
        allowedActions: ["UPDATE", "PAUSE"],
        id: 5,
        status: "ACTIVE",
        version: 4,
      }),
    ).toEqual({ allowedActions: ["UPDATE", "PAUSE"], id: 5, status: "ACTIVE", version: 4 });
  });
});
