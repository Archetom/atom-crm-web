import { describe, expect, it } from "vitest";

import { contractKeys } from "./query-keys";

describe("contract summary query key", () => {
  it("keeps every server filter but excludes pagination and ordering", () => {
    const first = contractKeys.summary("member-7", {
      customerId: 12,
      keyword: "年度续约",
      page: 1,
      size: 20,
      sortDirection: "DESC",
      sortField: "UPDATED_TIME",
      status: "ACTIVE",
    });
    const second = contractKeys.summary("member-7", {
      customerId: 12,
      keyword: "年度续约",
      page: 3,
      size: 50,
      sortDirection: "ASC",
      sortField: "NAME",
      status: "ACTIVE",
    });

    expect(first).toEqual(second);
    expect(
      contractKeys.summary("member-7", {
        customerId: 12,
        keyword: "年度续约",
        status: "VOIDED",
      }),
    ).not.toEqual(first);
  });
});
