import { describe, expect, it } from "vitest";

import {
  toWorkTaskSeriesCreateRequest,
  toWorkTaskSeriesUpdateRequest,
  type WorkTaskSeriesCreateValues,
} from "./work-task-series-form";

describe("toWorkTaskSeriesCreateRequest", () => {
  it("sends only the minimal weekly draft template", () => {
    expect(
      toWorkTaskSeriesCreateRequest({
        assigneeActorId: 8,
        endLocalDate: "2026-12-31",
        frequency: "WEEKLY",
        interval: 2,
        lastDayOfMonth: false,
        localTime: "09:30",
        startLocalDate: "2026-08-01",
        title: "  每两周回顾  ",
        weekdays: ["MONDAY", "WEDNESDAY"],
        zoneId: "Asia/Shanghai",
      }),
    ).toEqual({
      assigneeActorId: 8,
      endLocalDate: "2026-12-31",
      localTime: "09:30:00",
      recurrenceFrequency: "WEEKLY",
      recurrenceInterval: 2,
      startLocalDate: "2026-08-01",
      title: "每两周回顾",
      weekdays: ["MONDAY", "WEDNESDAY"],
      zoneId: "Asia/Shanghai",
    });
  });

  it("fails closed for incomplete or inconsistent recurrence rules", () => {
    expect(
      toWorkTaskSeriesCreateRequest({
        assigneeActorId: 8,
        frequency: "MONTHLY",
        interval: 1,
        lastDayOfMonth: false,
        localTime: "09:30",
        startLocalDate: "2026-02-31",
        title: "每月回顾",
        weekdays: [],
        zoneId: "not-a-timezone",
      }),
    ).toBeNull();
    expect(
      toWorkTaskSeriesCreateRequest({
        assigneeActorId: 8,
        frequency: "WEEKLY",
        interval: 1,
        lastDayOfMonth: false,
        localTime: "09:30",
        startLocalDate: "2026-08-01",
        title: "每周回顾",
        weekdays: [],
        zoneId: "Asia/Shanghai",
      }),
    ).toBeNull();
    expect(
      toWorkTaskSeriesCreateRequest({
        assigneeActorId: 8,
        frequency: "DAILY",
        interval: 1,
        lastDayOfMonth: true,
        localTime: "09:30",
        startLocalDate: "2026-08-01",
        title: "每日回顾",
        weekdays: [],
        zoneId: "Asia/Shanghai",
      }),
    ).toBeNull();
  });

  it("sends an explicit non-empty description, one supported priority and unique followers", () => {
    expect(
      toWorkTaskSeriesCreateRequest({
        assigneeActorId: 8,
        description: "  每次回顾前整理资料  ",
        followerActorIds: [9, 10],
        frequency: "WEEKLY",
        interval: 1,
        lastDayOfMonth: false,
        localTime: "09:30",
        priority: "HIGH",
        startLocalDate: "2026-08-01",
        title: "每周回顾",
        weekdays: ["MONDAY"],
        zoneId: "Asia/Shanghai",
      }),
    ).toEqual({
      assigneeActorId: 8,
      description: "每次回顾前整理资料",
      followerActorIds: [9, 10],
      localTime: "09:30:00",
      priority: "HIGH",
      recurrenceFrequency: "WEEKLY",
      recurrenceInterval: 1,
      startLocalDate: "2026-08-01",
      title: "每周回顾",
      weekdays: ["MONDAY"],
      zoneId: "Asia/Shanghai",
    });
  });

  it("fails closed for an overlong description, unsupported priority or invalid followers", () => {
    const base: WorkTaskSeriesCreateValues = {
      assigneeActorId: 8,
      frequency: "WEEKLY",
      interval: 1,
      lastDayOfMonth: false,
      localTime: "09:30",
      startLocalDate: "2026-08-01",
      title: "每周回顾",
      weekdays: ["MONDAY"],
      zoneId: "Asia/Shanghai",
    };
    expect(toWorkTaskSeriesCreateRequest({ ...base, description: "a".repeat(10_001) })).toBeNull();
    expect(
      toWorkTaskSeriesCreateRequest({
        ...base,
        priority: "CUSTOM" as unknown as WorkTaskSeriesCreateValues["priority"],
      }),
    ).toBeNull();
    expect(toWorkTaskSeriesCreateRequest({ ...base, followerActorIds: [9, 9] })).toBeNull();
    expect(
      toWorkTaskSeriesCreateRequest({
        ...base,
        followerActorIds: Array.from({ length: 51 }, (_, index) => index + 1),
      }),
    ).toBeNull();
  });

  it("builds a complete versioned update without accepting duplicate followers", () => {
    expect(
      toWorkTaskSeriesUpdateRequest({
        assigneeActorId: 8,
        description: "保留完整基线",
        followerActorIds: [9, 10],
        frequency: "MONTHLY",
        interval: 1,
        lastDayOfMonth: true,
        localTime: "09:30",
        priority: "HIGH",
        startLocalDate: "2026-08-01",
        title: "每月回顾",
        version: 3,
        weekdays: [],
        zoneId: "Asia/Shanghai",
      }),
    ).toEqual({
      assigneeActorId: 8,
      description: "保留完整基线",
      followerActorIds: [9, 10],
      lastDayOfMonth: true,
      localTime: "09:30:00",
      priority: "HIGH",
      recurrenceFrequency: "MONTHLY",
      recurrenceInterval: 1,
      startLocalDate: "2026-08-01",
      title: "每月回顾",
      version: 3,
      zoneId: "Asia/Shanghai",
    });
    expect(
      toWorkTaskSeriesUpdateRequest({
        assigneeActorId: 8,
        description: "重复关注人",
        followerActorIds: [9, 9],
        frequency: "DAILY",
        interval: 1,
        lastDayOfMonth: false,
        localTime: "09:30",
        priority: "HIGH",
        startLocalDate: "2026-08-01",
        title: "每日回顾",
        version: 3,
        weekdays: [],
        zoneId: "Asia/Shanghai",
      }),
    ).toBeNull();
  });
});
