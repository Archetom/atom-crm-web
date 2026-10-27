import { describe, expect, it } from "vitest";

import { toContractListItem } from "./contract-list-item";

describe("toContractListItem", () => {
  it("keeps server-returned custom values while dropping money fields", () => {
    expect(
      toContractListItem({
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
        status: "ACTIVE",
        subtotal: 100,
        discountRate: 0.9,
        totalAmount: 90,
        customFields: { internal: ["ignored"] },
      }),
    ).toEqual({
      id: 8,
      version: 3,
      customerId: 4,
      customFields: { internal: ["ignored"] },
      contactId: 5,
      ownerActorId: 2,
      name: "年度续约",
      number: "HT-20260726-0008",
      orderDate: "2026-07-26",
      startDate: "2026-08-01",
      endDate: "2027-07-31",
      status: "ACTIVE",
    });
  });

  it("keeps nullable business fields without inventing values", () => {
    expect(toContractListItem({ customerId: 4, id: 8, version: 0 })).toEqual({
      id: 8,
      version: 0,
      customerId: 4,
      contactId: null,
      ownerActorId: null,
      name: null,
      number: null,
      orderDate: null,
      startDate: null,
      endDate: null,
      status: null,
    });
  });

  it("fails closed without a stable contract/customer/version identity", () => {
    expect(toContractListItem({ customerId: 4, id: 8 })).toBeNull();
    expect(toContractListItem({ customerId: 4, id: 8, version: -1 })).toBeNull();
    expect(toContractListItem({ customerId: 0, id: 8, version: 1 })).toBeNull();
    expect(toContractListItem({ customerId: 4, id: 0, version: 1 })).toBeNull();
  });
});
