import { describe, expect, it } from "vitest";

import { toProductDetail } from "./product-detail";

describe("toProductDetail", () => {
  it("keeps server-projected custom values and controlled FILE metadata without owner values", () => {
    expect(
      toProductDetail({
        availability: "AVAILABLE",
        categoryName: "订阅",
        code: "PLAN-A",
        customFields: { internal: ["hidden"] },
        description: "标准服务",
        fileFields: {
          specification: [
            {
              actualBytes: 24,
              displayName: "规格说明.pdf",
              fileId: 18,
              mediaType: "application/pdf",
            },
          ],
          "unsafe-code": [{ fileId: 19 }],
        },
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
      customFields: { internal: ["hidden"] },
      createdTime: null,
      description: "标准服务",
      fileFields: [
        {
          attachments: [
            {
              actualBytes: 24,
              displayName: "规格说明.pdf",
              fileId: 18,
              mediaType: "application/pdf",
            },
          ],
          fieldCode: "specification",
        },
      ],
      id: 8,
      listPrice: 99.99,
      name: "入门套餐",
      status: "ACTIVE",
      unit: "套",
      updatedTime: null,
      version: 3,
    });
  });

  it("fails closed when its stable edit identity is unavailable", () => {
    expect(toProductDetail({ id: 8, name: "入门套餐" })).toBeNull();
    expect(toProductDetail({ id: 8, version: 3 })).toBeNull();
  });
});
