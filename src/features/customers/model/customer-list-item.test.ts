import { describe, expect, it } from "vitest";

import { toCustomerListItem } from "./customer-list-item";

describe("toCustomerListItem", () => {
  it("keeps server-visible custom field values for an explicitly selected list column", () => {
    expect(
      toCustomerListItem({
        id: 1,
        lastActivityContent: "确认需求范围",
        lastActivityTime: "2026-08-11T09:30:00",
        name: "Acme",
        version: 2,
        ownerActorId: 2,
        phoneNumber: "***1234",
        customFields: { cf_industry: ["manufacturing"], empty: [1] },
        status: "ACTIVE",
        starred: true,
        tags: ["重点", 3],
        updatedTime: "2026-07-25T00:00:00",
      }),
    ).toEqual({
      id: 1,
      customFields: { cf_industry: ["manufacturing"], empty: [] },
      lastActivityContent: "确认需求范围",
      lastActivityTime: "2026-08-11T09:30:00",
      name: "Acme",
      ownerActorId: 2,
      phoneNumber: "***1234",
      status: "ACTIVE",
      starred: true,
      tags: ["重点"],
      updatedTime: "2026-07-25T00:00:00",
      version: 2,
    });
  });

  it("fails closed when the stable identity fields are missing", () => {
    expect(toCustomerListItem({ id: 1 })).toBeNull();
  });

  it("does not treat a malformed last activity time as a list value", () => {
    expect(
      toCustomerListItem({
        id: 1,
        name: "Acme",
        lastActivityTime: "tomorrow morning",
      }),
    ).toMatchObject({ lastActivityTime: null });
  });
});
