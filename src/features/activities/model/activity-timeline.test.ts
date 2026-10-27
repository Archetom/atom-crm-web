import { describe, expect, it } from "vitest";

import { toActivityTimelineItem } from "./activity-timeline";

describe("toActivityTimelineItem", () => {
  it("keeps only the narrow server-returned activity timeline projection", () => {
    expect(
      toActivityTimelineItem({
        category: "CALL",
        content: "已确认下周安排演示。",
        creatorActorId: 9,
        id: 8,
        kind: "FOLLOW_UP",
        nextContactTime: "2026-07-30T09:00:00",
        occurredTime: "2026-07-25T09:00:00",
        purpose: "需求确认",
        relations: [{ objectType: "CONTACT", recordId: 7 }],
        subjectId: 6,
        subjectType: "CUSTOMER",
        version: 3,
      }),
    ).toEqual({
      category: "CALL",
      content: "已确认下周安排演示。",
      id: 8,
      kind: "FOLLOW_UP",
      nextContactTime: "2026-07-30T09:00:00",
      occurredTime: "2026-07-25T09:00:00",
      purpose: "需求确认",
    });
  });

  it("fails closed when the stable timeline identity or required content is unavailable", () => {
    expect(
      toActivityTimelineItem({ content: "已联系", occurredTime: "2026-07-25T09:00:00" }),
    ).toBeNull();
    expect(toActivityTimelineItem({ id: 8, occurredTime: "2026-07-25T09:00:00" })).toBeNull();
    expect(toActivityTimelineItem({ content: "已联系", id: 8 })).toBeNull();
  });
});
