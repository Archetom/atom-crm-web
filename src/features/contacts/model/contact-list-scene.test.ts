import { describe, expect, it } from "vitest";

import { contactListSceneFromSearch, withContactListScene } from "./contact-list-scene";

describe("contact list scenes", () => {
  it("restores the supported owner and personal scenes from URL search parameters", () => {
    expect(contactListSceneFromSearch("scene=mine")).toBe("mine");
    expect(contactListSceneFromSearch("scene=subordinates")).toBe("subordinates");
    expect(contactListSceneFromSearch("scene=starred")).toBe("starred");
  });

  it("uses the authenticated actor only when it is a positive server identity", () => {
    expect(withContactListScene({ page: 1, size: 20 }, "mine", 7)).toEqual({
      page: 1,
      size: 20,
      ownerActorId: 7,
    });
    expect(withContactListScene({ page: 1, size: 20 }, "mine", null)).toEqual({
      page: 1,
      size: 20,
    });
    expect(withContactListScene({ page: 1, size: 20 }, "subordinates", null)).toEqual({
      page: 1,
      size: 20,
      subordinateOwnerOnly: true,
    });
    expect(withContactListScene({ page: 1, size: 20 }, "starred", null)).toEqual({
      page: 1,
      size: 20,
      starred: true,
    });
  });
});
