import { describe, expect, it } from "vitest";

import { selectedProductIdFromSearch } from "./product-list-route";

describe("product list detail selection", () => {
  it("restores only a positive safe product ID from the list URL", () => {
    expect(selectedProductIdFromSearch("keyword=foo&productId=42")).toBe(42);
    expect(selectedProductIdFromSearch("productId=0")).toBeNull();
    expect(selectedProductIdFromSearch("productId=-42")).toBeNull();
    expect(selectedProductIdFromSearch("productId=42.5")).toBeNull();
    expect(selectedProductIdFromSearch("productId=9007199254740992")).toBeNull();
  });
});
