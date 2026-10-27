import { describe, expect, it } from "vitest";

import { toWorkTaskCreateRequest, type WorkTaskCreateValues } from "./work-task-form";

describe("toWorkTaskCreateRequest", () => {
  it("sends only user-entered task basics and a server-selected assignee", () => {
    expect(
      toWorkTaskCreateRequest({
        assigneeActorId: 8,
        dueTime: "2026-07-27T09:00",
        title: "  回访客户  ",
      }),
    ).toEqual({ assigneeActorId: 8, dueTime: "2026-07-27T09:00", title: "回访客户" });
  });

  it("sends an explicit non-empty description, priority, and unique followers", () => {
    expect(
      toWorkTaskCreateRequest({
        assigneeActorId: 8,
        description: "  确认回访计划  ",
        followerActorIds: [9, 10],
        priority: "HIGH",
        title: "回访客户",
      }),
    ).toEqual({
      assigneeActorId: 8,
      description: "确认回访计划",
      followerActorIds: [9, 10],
      priority: "HIGH",
      title: "回访客户",
    });
  });

  it("sends only a complete supported explicit business-record link", () => {
    expect(
      toWorkTaskCreateRequest({
        assigneeActorId: 8,
        businessObjectType: "CUSTOMER",
        businessRecordId: 27,
        title: "回访客户",
      }),
    ).toEqual({
      assigneeActorId: 8,
      businessObjectType: "CUSTOMER",
      businessRecordId: 27,
      title: "回访客户",
    });
    expect(
      toWorkTaskCreateRequest({
        assigneeActorId: 8,
        businessObjectType: "PRODUCT" as never,
        businessRecordId: 27,
        title: "回访客户",
      }),
    ).toBeNull();
    expect(
      toWorkTaskCreateRequest({
        assigneeActorId: 8,
        businessObjectType: "CUSTOMER",
        title: "回访客户",
      }),
    ).toBeNull();
  });

  it("fails closed without a stable selected assignee or title", () => {
    expect(toWorkTaskCreateRequest({ assigneeActorId: 0, title: "任务" })).toBeNull();
    expect(toWorkTaskCreateRequest({ assigneeActorId: 8, title: " " })).toBeNull();
  });

  it("fails closed for an overlong description, unsupported priority, or invalid followers", () => {
    expect(
      toWorkTaskCreateRequest({
        assigneeActorId: 8,
        description: "a".repeat(10_001),
        title: "任务",
      }),
    ).toBeNull();
    expect(
      toWorkTaskCreateRequest({
        assigneeActorId: 8,
        priority: "CUSTOM" as unknown as WorkTaskCreateValues["priority"],
        title: "任务",
      }),
    ).toBeNull();
    expect(
      toWorkTaskCreateRequest({
        assigneeActorId: 8,
        followerActorIds: [9, 9],
        title: "任务",
      }),
    ).toBeNull();
    expect(
      toWorkTaskCreateRequest({
        assigneeActorId: 8,
        followerActorIds: Array.from({ length: 51 }, (_value, index) => index + 1),
        title: "任务",
      }),
    ).toBeNull();
  });
});
