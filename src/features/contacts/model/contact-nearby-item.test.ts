import { describe, expect, it } from "vitest";

import { toContactNearbyItem } from "./contact-nearby-item";

describe("toContactNearbyItem", () => {
  it("keeps a server-returned contact projection with its distance", () => {
    expect(
      toContactNearbyItem({
        contact: { id: 8, name: "附近联系人", status: "ACTIVE", tags: ["重点"] },
        distanceMeters: 350,
      }),
    ).toEqual({
      contact: {
        id: 8,
        name: "附近联系人",
        customerId: null,
        nextContactTime: null,
        lastActivityContent: null,
        lastActivityTime: null,
        ownerActorId: null,
        phoneNumber: null,
        jobTitle: null,
        status: "ACTIVE",
        starred: false,
        tags: ["重点"],
      },
      distanceMeters: 350,
    });
  });

  it("fails closed when a response omits its nested contact or a valid distance", () => {
    expect(toContactNearbyItem({ distanceMeters: 350 })).toBeNull();
    expect(
      toContactNearbyItem({ contact: { id: 8, name: "附近联系人" }, distanceMeters: -1 }),
    ).toBeNull();
  });
});
