import { describe, expect, it } from "vitest";

import { toLeadListItem } from "./lead-list-item";

describe("toLeadListItem", () => {
  it("keeps server-visible custom fields for a selected list column", () => {
    expect(
      toLeadListItem({
        id: 8,
        name: "张三",
        version: 3,
        customerId: 7,
        nextContactTime: "2026-08-11T09:30:00",
        lastActivityTime: "2026-08-11T09:15:00",
        lastActivityContent: "确认需求范围",
        ownerActorId: 9,
        phoneNumber: "***1234",
        jobTitle: "采购经理",
        status: "ACTIVE",
        starred: true,
        tags: ["重点", 7],
        customFields: { cf_source: ["exhibition"] },
      }),
    ).toEqual({
      id: 8,
      customFields: { cf_source: ["exhibition"] },
      name: "张三",
      customerId: 7,
      nextContactTime: "2026-08-11T09:30:00",
      lastActivityTime: "2026-08-11T09:15:00",
      lastActivityContent: "确认需求范围",
      ownerActorId: 9,
      phoneNumber: "***1234",
      jobTitle: "采购经理",
      status: "ACTIVE",
      starred: true,
      tags: ["重点"],
      version: 3,
    });
  });

  it("fails closed when the stable lead identity is unavailable", () => {
    expect(toLeadListItem({ id: 8 })).toBeNull();
    expect(toLeadListItem({ name: "张三" })).toBeNull();
  });

  it("does not treat malformed contact or activity times as list values", () => {
    expect(
      toLeadListItem({
        id: 8,
        name: "张三",
        nextContactTime: "tomorrow morning",
        lastActivityTime: "tomorrow morning",
      }),
    ).toMatchObject({ nextContactTime: null, lastActivityTime: null });
  });
});
