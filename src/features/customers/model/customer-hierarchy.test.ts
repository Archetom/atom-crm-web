import { describe, expect, it } from "vitest";

import { toCustomerHierarchy, visibleDescendantIds } from "./customer-hierarchy";

describe("toCustomerHierarchy", () => {
  it("keeps only the visible hierarchy returned for the requested customer", () => {
    const hierarchy = toCustomerHierarchy(
      {
        requestedCustomerId: 2,
        customers: [
          { id: 1, name: "集团", parentCustomerId: null },
          { id: 2, name: "华东", parentCustomerId: 1 },
          { id: 3, name: "上海", parentCustomerId: 2 },
          { id: 4, name: "浦东", parentCustomerId: 3 },
        ],
      },
      2,
    );

    expect(hierarchy).toMatchObject({ requestedCustomerId: 2 });
    expect(hierarchy === null ? [] : [...visibleDescendantIds(hierarchy)]).toEqual([3, 4]);
  });

  it("fails closed on an incomplete response", () => {
    expect(toCustomerHierarchy({ requestedCustomerId: 2, customers: [{ id: 2 }] }, 2)).toBeNull();
    expect(toCustomerHierarchy({ requestedCustomerId: 3, customers: [] }, 2)).toBeNull();
  });
});
