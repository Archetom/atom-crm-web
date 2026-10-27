import { describe, expect, it } from "vitest";

import { toCustomerPoolCustomerListItem } from "./customer-pool-customer-list-item";

describe("toCustomerPoolCustomerListItem", () => {
  it("retains the generated customer response version for pool actions", () => {
    expect(
      toCustomerPoolCustomerListItem({
        id: 8,
        name: "远望科技",
        ownerActorId: 3,
        version: 2,
      }),
    ).toMatchObject({ id: 8, name: "远望科技", ownerActorId: 3, version: 2 });
  });

  it("does not enable actions without a server-issued version", () => {
    expect(toCustomerPoolCustomerListItem({ id: 8, name: "远望科技" })).toBeNull();
  });
});
