import { describe, expect, it } from "vitest";

import { toWorkTaskUpdateRequest } from "./work-task-edit-form";

describe("toWorkTaskUpdateRequest", () => {
  it("sends the complete manager structure baseline with the current version", () => {
    expect(
      toWorkTaskUpdateRequest({
        description: "确认下周安排",
        dueTime: "2026-07-30T09:00",
        priority: "HIGH",
        title: "  回访客户  ",
        version: 4,
      }),
    ).toEqual({
      description: "确认下周安排",
      dueTime: "2026-07-30T09:00",
      priority: "HIGH",
      title: "回访客户",
      version: 4,
    });
  });

  it("fails closed without a supported priority, version, or title", () => {
    expect(
      toWorkTaskUpdateRequest({
        description: "",
        priority: "NORMAL",
        title: " ",
        version: 4,
      }),
    ).toBeNull();
    expect(
      toWorkTaskUpdateRequest({
        description: "",
        priority: "NORMAL",
        title: "任务",
        version: -1,
      }),
    ).toBeNull();
  });
});
