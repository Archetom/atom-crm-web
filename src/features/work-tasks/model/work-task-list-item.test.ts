import { describe, expect, it } from "vitest";

import { toWorkTaskListItem } from "./work-task-list-item";

describe("toWorkTaskListItem", () => {
  it("keeps the server-authorized business-record reference with the Work task browse projection", () => {
    expect(
      toWorkTaskListItem({
        businessObjectType: "CUSTOMER",
        businessRecordId: 7,
        completedTime: "2026-07-26T10:00:00",
        createdByActorId: 8,
        currentAssigneeActorId: 9,
        description: "不应进入浏览器缓存",
        dueTime: "2026-07-27T09:00:00",
        followerActorIds: [10],
        id: 11,
        originKind: "SERIES",
        overdue: false,
        priority: "HIGH",
        status: "TODO",
        title: "回访客户",
        version: 3,
        worklistProjectionVersion: 12,
      }),
    ).toEqual({
      businessRecord: { objectType: "CUSTOMER", recordId: 7 },
      dueTime: "2026-07-27T09:00:00",
      id: 11,
      overdue: false,
      priority: "HIGH",
      status: "TODO",
      title: "回访客户",
      version: 3,
    });
  });

  it("fails closed without a stable task identity and computed overdue state", () => {
    expect(toWorkTaskListItem({ id: 11, title: "回访客户", version: 3 })).toBeNull();
    expect(toWorkTaskListItem({ id: 0, overdue: false, title: "回访客户", version: 3 })).toBeNull();
  });

  it("hides an incomplete or unsupported business-record reference", () => {
    expect(
      toWorkTaskListItem({
        businessObjectType: "PRODUCT",
        businessRecordId: 7,
        id: 11,
        overdue: false,
        title: "回访客户",
        version: 3,
      }),
    ).toMatchObject({ businessRecord: null, id: 11 });
  });
});
