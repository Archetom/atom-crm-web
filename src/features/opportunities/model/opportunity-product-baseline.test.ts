import { describe, expect, it } from "vitest";

import { decodeOpportunityProductBaseline } from "./opportunity-product-baseline";

describe("decodeOpportunityProductBaseline", () => {
  it("keeps the complete versioned product replacement input", () => {
    expect(
      decodeOpportunityProductBaseline({
        lines: [
          {
            categoryName: "订阅",
            productCode: "PLAN-A",
            productId: 9,
            productName: "入门套餐",
            quantity: 2,
            unit: "套",
            unitPrice: 99.9,
          },
        ],
        opportunityId: 8,
        version: 3,
      }),
    ).toEqual({
      lines: [
        {
          categoryName: "订阅",
          productCode: "PLAN-A",
          productId: 9,
          productName: "入门套餐",
          quantity: 2,
          unit: "套",
          unitPrice: 99.9,
        },
      ],
      opportunityId: 8,
      version: 3,
    });
  });

  it("fails closed for an incomplete or duplicate replacement line", () => {
    expect(() =>
      decodeOpportunityProductBaseline({
        lines: [{ productId: 9, productName: "入门套餐", quantity: 1 }],
        opportunityId: 8,
        version: 3,
      }),
    ).toThrow("商机产品完整基线暂时不可用");
    expect(() =>
      decodeOpportunityProductBaseline({
        lines: [
          { productId: 9, productName: "入门套餐", quantity: 1, unitPrice: 99.9 },
          { productId: 9, productName: "重复", quantity: 1, unitPrice: 99.9 },
        ],
        opportunityId: 8,
        version: 3,
      }),
    ).toThrow("商机产品完整基线暂时不可用");
  });
});
