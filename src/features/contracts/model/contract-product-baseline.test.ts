import { describe, expect, it } from "vitest";

import { decodeContractProductBaseline } from "./contract-product-baseline";

describe("decodeContractProductBaseline", () => {
  it("keeps the complete, versioned contract product replacement input", () => {
    expect(
      decodeContractProductBaseline({
        contractId: 8,
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
        version: 3,
      }),
    ).toEqual({
      contractId: 8,
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
      version: 3,
    });
  });

  it("fails closed for incomplete or duplicate product lines", () => {
    expect(() =>
      decodeContractProductBaseline({
        contractId: 8,
        lines: [{ productId: 9, productName: "入门套餐", quantity: 1, unitPrice: 99.9 }],
        version: 3,
      }),
    ).toThrow("合同产品完整基线暂时不可用");
    expect(() =>
      decodeContractProductBaseline({
        contractId: 8,
        lines: [
          {
            productCode: "PLAN-A",
            productId: 9,
            productName: "入门套餐",
            quantity: 1,
            unitPrice: 99.9,
          },
          {
            productCode: "PLAN-B",
            productId: 9,
            productName: "重复",
            quantity: 1,
            unitPrice: 99.9,
          },
        ],
        version: 3,
      }),
    ).toThrow("合同产品完整基线暂时不可用");
  });
});
