import { describe, expect, it } from "vitest";

import { opportunityListSceneFromSearch, withOpportunityListScene } from "./opportunity-list-scene";

describe("opportunity list scenes", () => {
  it("rejects unsupported URL scenes", () => {
    expect(opportunityListSceneFromSearch("scene=won")).toBe("won");
    expect(opportunityListSceneFromSearch("scene=open")).toBe("all");
  });

  it("maps supported owner, star, and outcome scenes to exact query fields", () => {
    expect(withOpportunityListScene({ page: 1, size: 20 }, "mine", 7)).toMatchObject({
      ownerActorId: 7,
    });
    expect(withOpportunityListScene({ page: 1, size: 20 }, "starred", null)).toMatchObject({
      starred: true,
    });
    expect(withOpportunityListScene({ page: 1, size: 20 }, "won", null)).toMatchObject({
      outcome: "WON",
    });
  });
});
