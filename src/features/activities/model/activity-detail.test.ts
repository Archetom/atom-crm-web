import { describe, expect, it } from "vitest";

import { toActivityDetail } from "./activity-detail";

describe("toActivityDetail", () => {
  it("keeps a complete server-returned follow-up update baseline", () => {
    expect(
      toActivityDetail({
        category: "CALL",
        content: "已确认下周安排演示。",
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
      nextContactTime: "2026-07-30T09:00:00",
      occurredTime: "2026-07-25T09:00:00",
      purpose: "需求确认",
      relations: [{ objectType: "CONTACT", recordId: 7 }],
      subjectId: 6,
      subjectType: "CUSTOMER",
      version: 3,
    });
  });

  it("fails closed for a system audit or an incomplete relation replacement baseline", () => {
    expect(
      toActivityDetail({
        category: "SYSTEM_AUDIT",
        content: "活动已创建",
        id: 8,
        kind: "SYSTEM",
        occurredTime: "2026-07-25T09:00:00",
        relations: [],
        subjectId: 6,
        subjectType: "CUSTOMER",
        version: 3,
      }),
    ).toBeNull();
    expect(
      toActivityDetail({
        category: "CALL",
        content: "已联系",
        id: 8,
        kind: "FOLLOW_UP",
        occurredTime: "2026-07-25T09:00:00",
        relations: [{ objectType: "CONTACT" }],
        subjectId: 6,
        subjectType: "CUSTOMER",
        version: 3,
      }),
    ).toBeNull();
  });
});
