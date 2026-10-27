import { describe, expect, it } from "vitest";

import type { components } from "~/api/generated/schema";

import { toCustomerPoolConfiguration } from "./customer-pool-configuration";

describe("toCustomerPoolConfiguration", () => {
  const configuration: components["schemas"]["CustomerPoolResponse"] = {
    id: 8,
    name: "华东客户公海",
    status: "ACTIVE",
    version: 3,
    customerCount: 12,
    administratorActorIds: [1],
    eligibleActorIds: [2],
    eligibleDepartmentIds: [3],
    dailyClaimLimit: 10,
    previousOwnerCooldownDays: 7,
    automaticReleaseEnabled: false,
    rules: [{ type: "STALE_UPDATE", inactiveDays: 30 }],
    administrator: true,
  };

  it("keeps only generated response fields required for safe management actions", () => {
    expect(toCustomerPoolConfiguration(configuration)).toEqual(configuration);
  });

  it("fails closed for malformed management baselines", () => {
    expect(toCustomerPoolConfiguration({ ...configuration, version: -1 })).toBeNull();
    expect(
      toCustomerPoolConfiguration({ ...configuration, administratorActorIds: [1, 1] }),
    ).toBeNull();
    expect(
      toCustomerPoolConfiguration({
        ...configuration,
        rules: [
          { type: "STALE_UPDATE", inactiveDays: 30 },
          { type: "STALE_UPDATE", inactiveDays: 60 },
        ],
      }),
    ).toBeNull();
    expect(toCustomerPoolConfiguration({ ...configuration, administrator: undefined })).toBeNull();
  });
});
