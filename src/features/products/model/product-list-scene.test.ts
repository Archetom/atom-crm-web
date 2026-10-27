import { describe, expect, it } from "vitest";

import { productListSceneFromSearch, withProductListScene } from "./product-list-scene";

describe("product list scenes", () => {
  it("restores only available product scenes from URL search parameters", () => {
    expect(productListSceneFromSearch("scene=available")).toBe("available");
    expect(productListSceneFromSearch("scene=archived")).toBe("all");
  });

  it("maps availability scenes to the exact published product values", () => {
    expect(withProductListScene({ page: 1, size: 20 }, "available")).toEqual({
      page: 1,
      size: 20,
      availability: "AVAILABLE",
    });
    expect(withProductListScene({ page: 1, size: 20 }, "unavailable")).toEqual({
      page: 1,
      size: 20,
      availability: "UNAVAILABLE",
    });
  });
});
