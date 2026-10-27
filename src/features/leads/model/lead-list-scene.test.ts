import { describe, expect, it } from "vitest";

import { leadListSceneFromSearch, withLeadListScene } from "./lead-list-scene";

describe("lead list scenes", () => {
  it("restores only supported scenes from URL search parameters", () => {
    expect(leadListSceneFromSearch("scene=mine")).toBe("mine");
    expect(leadListSceneFromSearch("scene=subordinates")).toBe("subordinates");
    expect(leadListSceneFromSearch("scene=starred")).toBe("starred");
    expect(leadListSceneFromSearch("scene=converted")).toBe("converted");
    expect(leadListSceneFromSearch("scene=unknown")).toBe("unconverted");
  });

  it("maps actor and star scenes to the generated query fields without guessing an actor", () => {
    expect(withLeadListScene({ page: 1, size: 20 }, "mine", 7)).toEqual({
      page: 1,
      size: 20,
      ownerActorId: 7,
      converted: false,
    });
    expect(withLeadListScene({ page: 1, size: 20 }, "starred", null)).toEqual({
      page: 1,
      size: 20,
      starred: true,
    });
    expect(withLeadListScene({ page: 1, size: 20 }, "converted", null)).toEqual({
      page: 1,
      size: 20,
      converted: true,
    });
    expect(withLeadListScene({ page: 1, size: 20 }, "subordinates", null)).toEqual({
      page: 1,
      size: 20,
      subordinateOwnerOnly: true,
      converted: false,
    });
    expect(withLeadListScene({ page: 1, size: 20 }, "mine", null)).toEqual({
      page: 1,
      size: 20,
      converted: false,
    });
  });
});
