import { describe, expect, it } from "vitest";

import { toNotificationInboxItem } from "./notification-inbox-item";

describe("toNotificationInboxItem", () => {
  it("keeps only a visible Work notification fact", () => {
    expect(
      toNotificationInboxItem({
        createdTime: "2026-07-26T12:00:00",
        dueTime: "2026-07-27T09:30:00",
        id: 8,
        kind: "WORK_TASK_REMINDER",
        priority: "HIGH",
        readTime: null,
        recipientActorId: 9,
        reminderOccurrenceId: 10,
        status: "UNREAD",
        taskId: 11,
        taskNotificationProjectionVersion: 12,
        title: "提交周报",
      }),
    ).toEqual({
      dueTime: "2026-07-27T09:30:00",
      id: 8,
      kind: "WORK_TASK_REMINDER",
      priority: "HIGH",
      status: "UNREAD",
      title: "提交周报",
    });
  });

  it("fails closed for withdrawn or malformed notification facts", () => {
    expect(
      toNotificationInboxItem({
        dueTime: "2026-07-27T09:30:00",
        id: 8,
        kind: "WORK_TASK_REMINDER",
        priority: "HIGH",
        status: "WITHDRAWN",
        title: "提交周报",
      }),
    ).toBeNull();
    expect(
      toNotificationInboxItem({
        dueTime: "2026-02-30T09:30:00",
        id: 8,
        kind: "WORK_TASK_REMINDER",
        priority: "HIGH",
        status: "UNREAD",
        title: "提交周报",
      }),
    ).toBeNull();
  });
});
