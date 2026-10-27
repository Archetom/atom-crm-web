import { describe, expect, it } from "vitest";

import { toOpportunityListItem } from "./opportunity-list-item";

describe("toOpportunityListItem", () => {
  it("keeps server-visible custom fields for a selected list column", () => {
    expect(
      toOpportunityListItem({
        id: 8,
        name: "年度续约",
        customerId: 7,
        nextContactTime: "2026-08-08T09:30:00",
        lastActivityTime: "2026-08-08T09:15:00",
        ownerActorId: 9,
        pipelineCode: "standard",
        stageCode: "proposal",
        outcome: "OPEN",
        status: "ACTIVE",
        starred: true,
        expectedCloseDate: "2026-09-30",
        estimatedAmount: 99999,
        description: "续约沟通",
        customFields: { cf_region: ["east"] },
      }),
    ).toEqual({
      id: 8,
      customFields: { cf_region: ["east"] },
      description: "续约沟通",
      estimatedAmount: 99999,
      expectedCloseDate: "2026-09-30",
      name: "年度续约",
      customerId: 7,
      nextContactTime: "2026-08-08T09:30:00",
      lastActivityTime: "2026-08-08T09:15:00",
      ownerActorId: 9,
      pipelineCode: "standard",
      stageCode: "proposal",
      outcome: "OPEN",
      status: "ACTIVE",
      starred: true,
    });
  });

  it("fails closed when the stable opportunity identity is unavailable", () => {
    expect(toOpportunityListItem({ id: 8 })).toBeNull();
    expect(toOpportunityListItem({ name: "年度续约" })).toBeNull();
  });

  it("drops malformed contact or activity times instead of inferring a display value", () => {
    expect(
      toOpportunityListItem({
        id: 8,
        name: "年度续约",
        nextContactTime: "tomorrow morning",
        lastActivityTime: "tomorrow morning",
      }),
    ).toMatchObject({ nextContactTime: null, lastActivityTime: null });
  });

  it("keeps only safe, server-provided amount and expected-close-date values", () => {
    expect(
      toOpportunityListItem({
        id: 8,
        name: "年度续约",
        estimatedAmount: -1,
        expectedCloseDate: "tomorrow",
        description: "",
      }),
    ).toMatchObject({ description: null, estimatedAmount: null, expectedCloseDate: null });
  });
});
