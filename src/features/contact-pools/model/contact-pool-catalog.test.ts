import { describe, expect, it } from "vitest";

import { decodeContactPoolCatalog } from "./contact-pool-catalog";

describe("decodeContactPoolCatalog", () => {
  it("keeps only the server-authorized catalog projection", () => {
    expect(
      decodeContactPoolCatalog([
        {
          id: 8,
          name: "华东联系人公海",
          status: "ACTIVE",
          contactCount: 12,
          administrator: false,
          eligibleActorIds: [9],
          rules: [{ type: "INACTIVE", inactiveDays: 30 }],
        },
      ]),
    ).toEqual([
      {
        id: 8,
        name: "华东联系人公海",
        status: "ACTIVE",
        contactCount: 12,
        administrator: false,
      },
    ]);
  });

  it("fails closed for incomplete, duplicate, or unknown status entries", () => {
    expect(() => decodeContactPoolCatalog({})).toThrow("联系人公海目录数据暂时不可用");
    expect(() =>
      decodeContactPoolCatalog([
        { id: 8, name: "A", status: "ACTIVE", contactCount: 0, administrator: false },
        { id: 8, name: "B", status: "ACTIVE", contactCount: 0, administrator: false },
      ]),
    ).toThrow("联系人公海目录数据暂时不可用");
    expect(() =>
      decodeContactPoolCatalog([
        { id: 8, name: "A", status: "ARCHIVED", contactCount: 0, administrator: false },
      ]),
    ).toThrow("联系人公海目录数据暂时不可用");
  });
});
