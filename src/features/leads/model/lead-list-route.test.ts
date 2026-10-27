import { describe, expect, it } from "vitest";

import { selectedLeadIdFromSearch } from "./lead-list-route";

describe("lead list detail selection", () => {
  it("restores only a positive safe lead ID from the list URL", () => {
    expect(selectedLeadIdFromSearch("keyword=foo&leadId=42")).toBe(42);
    expect(selectedLeadIdFromSearch("leadId=0")).toBeNull();
    expect(selectedLeadIdFromSearch("leadId=-42")).toBeNull();
    expect(selectedLeadIdFromSearch("leadId=42.5")).toBeNull();
    expect(selectedLeadIdFromSearch("leadId=9007199254740992")).toBeNull();
  });
});
