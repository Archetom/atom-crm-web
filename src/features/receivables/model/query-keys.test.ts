import { describe, expect, it } from "vitest";

import { receivableKeys } from "./query-keys";

describe("receivable summary query key", () => {
  it("keeps every server filter but excludes pagination and ordering", () => {
    const first = receivableKeys.summary("member-7", {
      contractId: 9,
      customerId: 12,
      keyword: "到账",
      page: 1,
      receivablePlanId: 3,
      size: 20,
      sortDirection: "DESC",
      sortField: "UPDATED_TIME",
    });
    const second = receivableKeys.summary("member-7", {
      contractId: 9,
      customerId: 12,
      keyword: "到账",
      page: 3,
      receivablePlanId: 3,
      size: 50,
      sortDirection: "ASC",
      sortField: "RECEIVED_DATE",
    });

    expect(first).toEqual(second);
    expect(
      receivableKeys.summary("member-7", {
        contractId: 10,
        customerId: 12,
        keyword: "到账",
      }),
    ).not.toEqual(first);
  });
});
