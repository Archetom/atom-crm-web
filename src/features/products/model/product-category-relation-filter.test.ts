import { describe, expect, it } from "vitest";

import {
  findProductCategoryOption,
  productCategoryOptions,
} from "./product-category-relation-filter";

describe("product category relation filter", () => {
  const categories = [
    {
      children: [
        {
          children: [],
          id: 2,
          name: "软件",
          parentCategoryId: 1,
          status: "ACTIVE",
          version: 0,
        },
      ],
      id: 1,
      name: "服务",
      parentCategoryId: null,
      status: "ACTIVE",
      version: 0,
    },
  ] as const;

  it("retains only ID and the contextual category label", () => {
    expect(productCategoryOptions(categories)).toEqual([
      { id: 1, name: "服务" },
      { id: 2, name: "服务 / 软件" },
    ]);
  });

  it("confirms a recovered category only when the current directory still contains it", () => {
    expect(findProductCategoryOption(categories, 2)).toEqual({ id: 2, name: "服务 / 软件" });
    expect(findProductCategoryOption(categories, 3)).toBeNull();
  });
});
