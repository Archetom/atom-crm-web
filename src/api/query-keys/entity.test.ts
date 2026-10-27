import { describe, expect, it } from "vitest";

import { createEntityQueryKeys } from "./entity";

describe("createEntityQueryKeys", () => {
  it("includes the identity and a stable, compact query object", () => {
    const customers = createEntityQueryKeys("customers");

    expect(
      customers.list("development:900001:900001", {
        keyword: "Acme",
        page: 1,
        starred: undefined,
      }),
    ).toEqual(["customers", "list", "development:900001:900001", { keyword: "Acme", page: 1 }]);
  });
});
