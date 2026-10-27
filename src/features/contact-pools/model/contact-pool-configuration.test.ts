import { describe, expect, it } from "vitest";

import { toContactPoolConfiguration } from "./contact-pool-configuration";

describe("toContactPoolConfiguration", () => {
  const configuration = {
    id: 8,
    name: "华东联系人公海",
    status: "ACTIVE",
    version: 3,
    contactCount: 12,
    administratorActorIds: [1],
    eligibleActorIds: [2],
    eligibleDepartmentIds: [3],
    dailyClaimLimit: 10,
    previousOwnerCooldownDays: 7,
    automaticReleaseEnabled: false,
    rules: [{ type: "STALE_UPDATE", inactiveDays: 30 }],
    administrator: true,
  };

  it("keeps only the management fields needed by the configuration list", () => {
    expect(toContactPoolConfiguration({ ...configuration, sensitive: "not projected" })).toEqual(
      configuration,
    );
  });

  it("fails closed for an incomplete or malformed management projection", () => {
    expect(toContactPoolConfiguration({ ...configuration, version: -1 })).toBeNull();
    expect(
      toContactPoolConfiguration({ ...configuration, administratorActorIds: [1, 1] }),
    ).toBeNull();
    expect(toContactPoolConfiguration({ ...configuration, administrator: "true" })).toBeNull();
    expect(
      toContactPoolConfiguration({
        ...configuration,
        rules: [
          { type: "STALE_UPDATE", inactiveDays: 30 },
          { type: "STALE_UPDATE", inactiveDays: 60 },
        ],
      }),
    ).toBeNull();
  });
});
