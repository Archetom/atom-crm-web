import { describe, expect, it } from "vitest";

import { toWorklistPage } from "./worklist-page";

describe("toWorklistPage", () => {
  const item = {
    dueTime: "2026-08-10T09:00:00",
    kind: "FOLLOW_UP",
    sourceId: 8,
    sourceVersion: 3,
    subjectId: 12,
    subjectType: "CUSTOMER",
    summary: "确认本周回访",
  };

  it("retains only a complete server-confirmed worklist projection", () => {
    expect(toWorklistPage({ items: [item], nextCursor: "opaque-cursor" })).toEqual({
      items: [item],
      nextCursor: "opaque-cursor",
    });
  });

  it("fails closed for an unknown kind, invalid acknowledgement fingerprint, or malformed cursor", () => {
    expect(
      toWorklistPage({ items: [{ ...item, kind: "UNREVIEWED" }], nextCursor: null }),
    ).toBeNull();
    expect(
      toWorklistPage({ items: [{ ...item, sourceVersion: -1 }], nextCursor: null }),
    ).toBeNull();
    expect(toWorklistPage({ items: [item], nextCursor: "" })).toBeNull();
  });
});
