import { describe, expect, it } from "vitest";

import { toLeadNearbyItem } from "./lead-nearby-item";

describe("toLeadNearbyItem", () => {
  it("keeps a server-returned lead projection with its distance", () => {
    expect(
      toLeadNearbyItem({
        lead: { id: 8, name: "附近线索", status: "ACTIVE", tags: ["重点"] },
        distanceMeters: 350,
      }),
    ).toEqual({
      lead: {
        id: 8,
        name: "附近线索",
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

  it("fails closed when a response omits its nested lead or a valid distance", () => {
    expect(toLeadNearbyItem({ distanceMeters: 350 })).toBeNull();
    expect(toLeadNearbyItem({ lead: { id: 8, name: "附近线索" }, distanceMeters: -1 })).toBeNull();
  });
});
