import { describe, expect, it } from "vitest";

import { toContractDetail } from "./contract-detail";

describe("toContractDetail", () => {
  it("keeps a money-free contract and product snapshot", () => {
    expect(
      toContractDetail({
        id: 8,
        version: 3,
        customerId: 4,
        contactId: 5,
        ownerActorId: 2,
        name: "年度续约",
        number: "HT-20260726-0008",
        orderDate: "2026-07-26",
        startDate: "2026-08-01",
        endDate: "2027-07-31",
        contractType: "标准合同",
        paymentType: "年付",
        remark: "客户已确认",
        status: "ACTIVE",
        subtotal: 100,
        discountRate: 0.9,
        totalAmount: 90,
        products: [
          {
            productId: 9,
            productName: "入门套餐",
            productCode: "PLAN-A",
            categoryName: "订阅",
            unit: "席位",
            quantity: 2.5,
            listPrice: 20,
            unitPrice: 18,
            discountRate: 0.9,
            lineAmount: 45,
          },
        ],
        collaborators: [{ actorId: 2, access: "READ" }],
        customFields: { source: ["续约"] },
        fileFields: {
          contract_file: [
            { actualBytes: 12, displayName: "合同.pdf", fileId: 1, mediaType: "application/pdf" },
          ],
        },
      }),
    ).toEqual({
      id: 8,
      version: 3,
      customerId: 4,
      opportunityId: null,
      contactId: 5,
      ownerActorId: 2,
      name: "年度续约",
      number: "HT-20260726-0008",
      orderDate: "2026-07-26",
      startDate: "2026-08-01",
      endDate: "2027-07-31",
      contractType: "标准合同",
      paymentType: "年付",
      remark: "客户已确认",
      status: "ACTIVE",
      customFields: { source: ["续约"] },
      fileFields: [
        {
          attachments: [
            {
              actualBytes: 12,
              displayName: "合同.pdf",
              fileId: 1,
              mediaType: "application/pdf",
            },
          ],
          fieldCode: "contract_file",
        },
      ],
      products: [
        {
          productId: 9,
          productName: "入门套餐",
          productCode: "PLAN-A",
          categoryName: "订阅",
          unit: "席位",
          quantity: "2.5",
        },
      ],
      createdTime: null,
      updatedTime: null,
    });
  });

  it("keeps no product lines when the server withholds the product snapshot", () => {
    expect(toContractDetail({ customerId: 4, id: 8, version: 0 })).toMatchObject({
      customerId: 4,
      id: 8,
      fileFields: [],
      products: [],
      version: 0,
    });
  });

  it("fails closed when contract identity or a returned product line is invalid", () => {
    expect(toContractDetail({ customerId: 4, id: 8 })).toBeNull();
    expect(toContractDetail({ customerId: 0, id: 8, version: 0 })).toBeNull();
    expect(
      toContractDetail({
        customerId: 4,
        id: 8,
        products: [{ productId: 9 }],
        version: 0,
      }),
    ).toBeNull();
  });
});
