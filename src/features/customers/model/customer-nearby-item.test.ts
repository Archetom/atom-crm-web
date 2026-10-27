import { describe, expect, it } from "vitest";

import { toCustomerNearbyItem } from "./customer-nearby-item";

describe("toCustomerNearbyItem", () => {
  it("keeps a server-returned customer projection with its distance", () => {
    expect(
      toCustomerNearbyItem({
        customer: { id: 8, name: "附近客户", status: "ACTIVE", tags: ["重点"] },
        distanceMeters: 350,
      }),
    ).toEqual({
      customer: {
        id: 8,
        lastActivityContent: null,
        lastActivityTime: null,
        name: "附近客户",
        ownerActorId: null,
        phoneNumber: null,
        status: "ACTIVE",
        starred: false,
        tags: ["重点"],
        updatedTime: null,
      },
      distanceMeters: 350,
    });
  });

  it("fails closed when a response omits its nested customer or a valid distance", () => {
    expect(toCustomerNearbyItem({ distanceMeters: 350 })).toBeNull();
    expect(
      toCustomerNearbyItem({ customer: { id: 8, name: "附近客户" }, distanceMeters: -1 }),
    ).toBeNull();
  });
});
