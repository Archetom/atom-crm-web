import { describe, expect, it } from "vitest";

import { receivablePlanKeys } from "./query-keys";

describe("receivable-plan summary query keys", () => {
  it("uses every server list filter but excludes pagination from plan money aggregates", () => {
    expect(
      receivablePlanKeys.summary("identity-a", {
        contractId: 12,
        conditions: [{ fieldCode: "payment_method", operator: "EQ", values: ["BANK_TRANSFER"] }],
        customerId: 8,
        keyword: "2",
        ownerActorId: 7,
        page: 3,
        size: 50,
      }),
    ).toEqual([
      "receivable-plans",
      "list",
      "identity-a",
      {
        contractId: 12,
        conditions: [{ fieldCode: "payment_method", operator: "EQ", values: ["BANK_TRANSFER"] }],
        customerId: 8,
        keyword: "2",
        ownerActorId: 7,
        summary: "plan-amounts",
      },
    ]);
  });

  it("keeps a server-owned saved view isolated from the default scene", () => {
    const allPlans = receivablePlanKeys.summary("identity-a", {
      page: 1,
      size: 20,
    });
    const savedView = receivablePlanKeys.summary("identity-a", {
      page: 1,
      savedViewId: 15,
      size: 20,
    });

    expect(savedView).not.toEqual(allPlans);
    expect(savedView).toEqual([
      "receivable-plans",
      "list",
      "identity-a",
      { savedViewId: 15, summary: "plan-amounts" },
    ]);
  });

  it("keeps the server-resolved subordinate-owner scene isolated from all plans", () => {
    const allPlans = receivablePlanKeys.summary("identity-a", {
      page: 1,
      size: 20,
    });
    const subordinatePlans = receivablePlanKeys.summary("identity-a", {
      page: 1,
      size: 20,
      subordinateOwnerOnly: true,
    });

    expect(subordinatePlans).not.toEqual(allPlans);
    expect(subordinatePlans).toEqual([
      "receivable-plans",
      "list",
      "identity-a",
      { subordinateOwnerOnly: true, summary: "plan-amounts" },
    ]);
  });
});
