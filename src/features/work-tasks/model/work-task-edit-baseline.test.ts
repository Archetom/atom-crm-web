import { describe, expect, it } from "vitest";

import { toWorkTaskEditBaseline } from "./work-task-edit-baseline";

describe("toWorkTaskEditBaseline", () => {
  it("keeps only the manager edit baseline from a visible open task", () => {
    expect(
      toWorkTaskEditBaseline({
        businessRecordId: 7,
        createdByActorId: 8,
        currentAssigneeActorId: 9,
        description: "确认下周安排",
        dueTime: "2026-07-30T09:00:00",
        followerActorIds: [10],
        id: 6,
        originKind: "MANUAL",
        overdue: false,
        priority: "HIGH",
        status: "TODO",
        title: "回访客户",
        version: 4,
      }),
    ).toEqual({
      description: "确认下周安排",
      dueTime: "2026-07-30T09:00:00",
      id: 6,
      priority: "HIGH",
      status: "TODO",
      title: "回访客户",
      version: 4,
    });
  });

  it("fails closed for a finished or incomplete structure baseline", () => {
    expect(
      toWorkTaskEditBaseline({
        description: null,
        dueTime: null,
        id: 6,
        priority: "NORMAL",
        status: "DONE",
        title: "回访客户",
        version: 4,
      }),
    ).toBeNull();
  });
});
