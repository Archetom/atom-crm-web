import { describe, expect, it } from "vitest";

import { selectedMarketingActivityIdFromSearch } from "./marketing-activity-route";

describe("marketing activity detail route", () => {
  it("accepts only a positive safe selected ID", () => {
    expect(selectedMarketingActivityIdFromSearch("activityId=42")).toBe(42);
    expect(selectedMarketingActivityIdFromSearch("activityId=0")).toBeNull();
    expect(selectedMarketingActivityIdFromSearch("activityId=-1")).toBeNull();
    expect(selectedMarketingActivityIdFromSearch("activityId=999999999999999999999")).toBeNull();
  });
});
