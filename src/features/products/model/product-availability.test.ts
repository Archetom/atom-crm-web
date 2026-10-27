import { describe, expect, it } from "vitest";

import {
  isProductAvailability,
  productAvailabilityLabel,
  productAvailabilityOptions,
} from "./product-availability";

describe("product availability", () => {
  it("keeps the closed server code set and Chinese labels", () => {
    expect(productAvailabilityOptions).toEqual([
      { label: "上架", value: "AVAILABLE" },
      { label: "下架", value: "UNAVAILABLE" },
    ]);
    expect(productAvailabilityLabel("AVAILABLE")).toBe("上架");
    expect(productAvailabilityLabel("UNAVAILABLE")).toBe("下架");
  });

  it("rejects an unknown code before it can be submitted", () => {
    expect(isProductAvailability("PUBLISHED")).toBe(false);
  });
});
