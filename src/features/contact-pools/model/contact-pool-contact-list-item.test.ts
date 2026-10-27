import { describe, expect, it } from "vitest";

import { toContactPoolContactListItem } from "./contact-pool-contact-list-item";

describe("toContactPoolContactListItem", () => {
  it("keeps the optimistic-lock version needed by pool actions", () => {
    expect(
      toContactPoolContactListItem({
        id: 8,
        name: "张三",
        version: 3,
        status: "IN_POOL",
        customFields: { secret: "not projected" },
      }),
    ).toMatchObject({ id: 8, name: "张三", version: 3, status: "IN_POOL" });
  });

  it("fails closed when a usable version is unavailable", () => {
    expect(toContactPoolContactListItem({ id: 8, name: "张三" })).toBeNull();
    expect(toContactPoolContactListItem({ id: 8, name: "张三", version: -1 })).toBeNull();
  });
});
