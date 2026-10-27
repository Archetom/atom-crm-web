import { describe, expect, it } from "vitest";

import { selectedOpportunityIdFromSearch } from "./opportunity-list-route";

describe("opportunity list detail selection", () => {
  it("restores only a positive safe opportunity ID from the list URL", () => {
    expect(selectedOpportunityIdFromSearch("keyword=foo&opportunityId=42")).toBe(42);
    expect(selectedOpportunityIdFromSearch("opportunityId=0")).toBeNull();
    expect(selectedOpportunityIdFromSearch("opportunityId=-42")).toBeNull();
    expect(selectedOpportunityIdFromSearch("opportunityId=42.5")).toBeNull();
    expect(selectedOpportunityIdFromSearch("opportunityId=9007199254740992")).toBeNull();
  });
});
