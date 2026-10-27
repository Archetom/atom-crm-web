import { describe, expect, it } from "vitest";

import {
  globalRecordListConfirmedRelationId,
  globalRecordListPositiveIdFromSearch,
  globalRecordListSceneFromSearch,
  globalRecordListStatusFromSearch,
  withGlobalRecordListScene,
} from "./global-record-list-scene";

describe("global record list scenes", () => {
  it("restores only scenes published by the surface", () => {
    expect(globalRecordListSceneFromSearch("scene=mine", true)).toBe("mine");
    expect(globalRecordListSceneFromSearch("scene=mine", false)).toBe("all");
    expect(globalRecordListSceneFromSearch("scene=subordinates", true, true)).toBe("subordinates");
    expect(globalRecordListSceneFromSearch("scene=subordinates", true)).toBe("all");
  });

  it("accepts only status values explicitly published by the surface", () => {
    const options = [
      { label: "生效", value: "ACTIVE" },
      { label: "已作废", value: "VOIDED" },
    ];

    expect(globalRecordListStatusFromSearch("status=ACTIVE", options)).toBe("ACTIVE");
    expect(globalRecordListStatusFromSearch("status=DELETED", options)).toBeUndefined();
  });

  it("uses only the authorization actor for the owner query", () => {
    expect(withGlobalRecordListScene({ page: 1, size: 20 }, "mine", 7)).toEqual({
      page: 1,
      size: 20,
      ownerActorId: 7,
    });
    expect(withGlobalRecordListScene({ page: 1, size: 20 }, "subordinates", 7)).toEqual({
      page: 1,
      size: 20,
      subordinateOwnerOnly: true,
    });
    expect(withGlobalRecordListScene({ page: 1, size: 20 }, "mine", null)).toEqual({
      page: 1,
      size: 20,
    });
  });

  it("restores relation filters only from exact positive safe integers", () => {
    expect(globalRecordListPositiveIdFromSearch("customerId=42", "customerId")).toBe(42);
    expect(globalRecordListPositiveIdFromSearch("receivablePlanId=8", "receivablePlanId")).toBe(8);
    expect(globalRecordListPositiveIdFromSearch("opportunityId=9", "opportunityId")).toBe(9);
    expect(globalRecordListPositiveIdFromSearch("opportunityId=9", "opportunityId")).toBe(9);
    expect(globalRecordListPositiveIdFromSearch("customerId=042", "customerId")).toBeUndefined();
    expect(globalRecordListPositiveIdFromSearch("customerId=1.5", "customerId")).toBeUndefined();
    expect(globalRecordListPositiveIdFromSearch("customerId=-1", "customerId")).toBeUndefined();
    expect(
      globalRecordListPositiveIdFromSearch("customerId=9007199254740992", "customerId"),
    ).toBeUndefined();
  });

  it("sends a relation filter only after the same entity is confirmed", () => {
    expect(globalRecordListConfirmedRelationId(42, 42)).toBe(42);
    expect(globalRecordListConfirmedRelationId(42, 43)).toBeUndefined();
    expect(globalRecordListConfirmedRelationId(42, undefined)).toBeUndefined();
  });
});
