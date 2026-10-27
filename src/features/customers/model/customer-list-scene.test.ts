import { describe, expect, it } from "vitest";

import { customerListSceneFromSearch, withCustomerListScene } from "./customer-list-scene";

describe("customer list scenes", () => {
  it("restores only supported URL scenes", () => {
    expect(customerListSceneFromSearch("keyword=atom&scene=mine")).toBe("mine");
    expect(customerListSceneFromSearch("scene=subordinates")).toBe("subordinates");
    expect(customerListSceneFromSearch("scene=unknown")).toBe("all");
  });

  it("translates the current member scene into a typed query", () => {
    expect(withCustomerListScene({ page: 1, size: 15 }, "mine", 7)).toEqual({
      page: 1,
      size: 15,
      ownerActorId: 7,
    });
    expect(withCustomerListScene({ page: 1, size: 15 }, "starred", 7)).toEqual({
      page: 1,
      size: 15,
      starred: true,
    });
    expect(withCustomerListScene({ page: 1, size: 15 }, "subordinates", 7)).toEqual({
      page: 1,
      size: 15,
      subordinateOwnerOnly: true,
    });
  });

  it("does not submit a local fallback actor identifier", () => {
    expect(withCustomerListScene({ page: 1 }, "mine", null)).toEqual({ page: 1 });
  });
});
