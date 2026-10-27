import { describe, expect, it } from "vitest";

import { decodeCustomerPoolCatalog } from "./customer-pool-catalog";

describe("decodeCustomerPoolCatalog", () => {
  it("projects only complete server-authorized customer pools", () => {
    expect(
      decodeCustomerPoolCatalog([
        {
          id: 8,
          name: "华东客户公海",
          status: "ACTIVE",
          customerCount: 12,
          administrator: false,
          version: 3,
        },
      ]),
    ).toEqual([
      {
        id: 8,
        name: "华东客户公海",
        status: "ACTIVE",
        customerCount: 12,
        administrator: false,
      },
    ]);
  });

  it("fails closed for incomplete, malformed, or duplicate catalog entries", () => {
    expect(() => decodeCustomerPoolCatalog([{ id: 8 }])).toThrow("客户公海目录");
    expect(() =>
      decodeCustomerPoolCatalog([
        {
          id: 8,
          name: "华东客户公海",
          status: "ACTIVE",
          customerCount: 1,
          administrator: false,
        },
        {
          id: 8,
          name: "华南客户公海",
          status: "ACTIVE",
          customerCount: 2,
          administrator: false,
        },
      ]),
    ).toThrow("客户公海目录");
  });
});
