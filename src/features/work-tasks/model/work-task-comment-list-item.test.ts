import { describe, expect, it } from "vitest";

import { toWorkTaskCommentListItem } from "./work-task-comment-list-item";

describe("toWorkTaskCommentListItem", () => {
  it("keeps only the task-bound comment browse projection", () => {
    expect(
      toWorkTaskCommentListItem({
        authorActorId: 9,
        content: "已确认下周回访时间。",
        createdTime: "2026-07-26T09:00:00",
        id: 12,
        taskId: 8,
        updatedTime: "2026-07-26T10:00:00",
        version: 3,
      }),
    ).toEqual({
      content: "已确认下周回访时间。",
      createdTime: "2026-07-26T09:00:00",
      id: 12,
      taskId: 8,
      version: 3,
    });
  });

  it("fails closed without a stable comment/task identity", () => {
    expect(toWorkTaskCommentListItem({ content: "评论", id: 12, version: 0 })).toBeNull();
    expect(toWorkTaskCommentListItem({ content: "评论", id: 0, taskId: 8, version: 0 })).toBeNull();
  });
});
