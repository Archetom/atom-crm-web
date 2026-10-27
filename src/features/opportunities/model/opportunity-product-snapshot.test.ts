import { describe, expect, it } from "vitest";

import { toOpportunityProductSnapshot } from "./opportunity-product-snapshot";

describe("toOpportunityProductSnapshot", () => {
  it("keeps a money-free server product projection", () => {
    expect(
      toOpportunityProductSnapshot({
        lines: [
          {
            categoryName: "订阅",
            discountRate: 10,
            lineAmount: 45,
            listPrice: 20,
            productCode: "PLAN-A",
            productId: 8,
            productName: "入门套餐",
            quantity: 2.5,
            unit: "席位",
            unitPrice: 18,
          },
        ],
        totalAmount: 45,
        version: 3,
      }),
    ).toEqual({
      lines: [
        {
          categoryName: "订阅",
          productCode: "PLAN-A",
          productId: 8,
          productName: "入门套餐",
          quantity: "2.5",
          unit: "席位",
        },
      ],
      version: 3,
    });
  });

  it("fails closed when the response lacks a stable snapshot version", () => {
    expect(toOpportunityProductSnapshot({ lines: [] })).toBeNull();
  });

  it("fails closed when any line lacks its stable product identity", () => {
    expect(
      toOpportunityProductSnapshot({
        lines: [{ productName: "缺少标识的产品" }],
        version: 3,
      }),
    ).toBeNull();
  });
});
