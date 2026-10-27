import { describe, expect, it } from "vitest";

import { toBatchActivityCreateRequests } from "./batch-activity";

describe("toBatchActivityCreateRequests", () => {
  it("creates one narrow generated request for every unique selected record", () => {
    expect(
      toBatchActivityCreateRequests([8, 12, 8], "CUSTOMER", {
        category: " CALL ",
        content: "  确认下周演示时间。 ",
        occurredTime: "2026-08-10T09:00:00",
        purpose: "  需求确认 ",
      }),
    ).toEqual([
      {
        category: "CALL",
        content: "确认下周演示时间。",
        occurredTime: "2026-08-10T09:00:00",
        purpose: "需求确认",
        subjectId: 8,
        subjectType: "CUSTOMER",
      },
      {
        category: "CALL",
        content: "确认下周演示时间。",
        occurredTime: "2026-08-10T09:00:00",
        purpose: "需求确认",
        subjectId: 12,
        subjectType: "CUSTOMER",
      },
    ]);
  });

  it("rejects an empty, unsafe, or oversized selection before the write is attempted", () => {
    const draft = {
      category: "CALL",
      content: "确认下一步。",
      occurredTime: "2026-08-10T09:00:00",
      purpose: "",
    };

    expect(toBatchActivityCreateRequests([], "LEAD", draft)).toBeNull();
    expect(toBatchActivityCreateRequests([0], "LEAD", draft)).toBeNull();
    expect(
      toBatchActivityCreateRequests(
        Array.from({ length: 101 }, (_, index) => index + 1),
        "LEAD",
        draft,
      ),
    ).toBeNull();
  });
});
