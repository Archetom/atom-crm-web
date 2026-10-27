import { describe, expect, it } from "vitest";

import { toProductListItem } from "./product-list-item";

describe("toProductListItem", () => {
  it("keeps only the money-free product catalog projection", () => {
    expect(
      toProductListItem({
        availability: "AVAILABLE",
        categoryName: "订阅",
        code: "PLAN-A",
        customFields: { cf_sku_group: ["standard"] },
        description: "不应进入列表投影",
        id: 8,
        listPrice: 99.99,
        name: "入门套餐",
        ownerActorId: 7,
        status: "ACTIVE",
        unit: "套",
        version: 3,
      }),
    ).toEqual({
      availability: "AVAILABLE",
      categoryName: "订阅",
      code: "PLAN-A",
      customFields: { cf_sku_group: ["standard"] },
      id: 8,
      name: "入门套餐",
      status: "ACTIVE",
      unit: "套",
    });
  });

  it("fails closed when the stable product identity is unavailable", () => {
    expect(toProductListItem({ id: 8 })).toBeNull();
    expect(toProductListItem({ name: "入门套餐" })).toBeNull();
  });
});
