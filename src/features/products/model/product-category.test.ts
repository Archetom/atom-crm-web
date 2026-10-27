import { describe, expect, it } from "vitest";

import { decodeProductCategoryTree, productCategoryOptions } from "./product-category";

describe("decodeProductCategoryTree", () => {
  it("keeps only the server-governed category tree fields", () => {
    expect(
      decodeProductCategoryTree([
        {
          children: [
            {
              children: [],
              id: 2,
              name: "软件服务",
              parentCategoryId: 1,
              status: "ACTIVE",
              version: 3,
            },
          ],
          id: 1,
          name: "解决方案",
          status: "ACTIVE",
          version: 2,
        },
      ]),
    ).toEqual([
      {
        children: [
          {
            children: [],
            id: 2,
            name: "软件服务",
            parentCategoryId: 1,
            status: "ACTIVE",
            version: 3,
          },
        ],
        id: 1,
        name: "解决方案",
        parentCategoryId: null,
        status: "ACTIVE",
        version: 2,
      },
    ]);
  });

  it("rejects malformed opaque category responses", () => {
    expect(() => decodeProductCategoryTree([{ children: [], id: 1, name: "分类" }])).toThrow(
      "产品分类目录数据暂时不可用",
    );
  });

  it("flattens only the returned category tree into selector labels", () => {
    const categories = decodeProductCategoryTree([
      {
        children: [
          {
            children: [],
            id: 2,
            name: "软件服务",
            parentCategoryId: 1,
            status: "ACTIVE",
            version: 3,
          },
        ],
        id: 1,
        name: "解决方案",
        status: "ACTIVE",
        version: 2,
      },
    ]);

    expect(productCategoryOptions(categories)).toEqual([
      { label: "解决方案", value: 1 },
      { label: "解决方案 / 软件服务", value: 2 },
    ]);
  });
});
