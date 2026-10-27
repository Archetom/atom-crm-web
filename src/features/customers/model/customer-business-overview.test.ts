import { describe, expect, it } from "vitest";

import {
  customerBusinessOverviewSources,
  toCustomerBusinessOverview,
} from "./customer-business-overview";

describe("toCustomerBusinessOverview", () => {
  it("keeps only the server-authorized values from every fixed card", () => {
    const overview = toCustomerBusinessOverview(
      {
        customerId: 8,
        cards: customerBusinessOverviewSources.map((source) => ({
          source,
          status: source === "ACTIVE_CONTRACT" ? "UNAVAILABLE" : "AVAILABLE",
          count: source === "ACTIVE_CONTRACT" ? 99 : 2,
          amount: source === "OPEN_OPPORTUNITY" ? 12.5 : null,
        })),
      },
      8,
    );

    expect(overview?.cards).toEqual([
      { source: "CONTACT", status: "AVAILABLE", count: 2, amount: null },
      { source: "OPEN_OPPORTUNITY", status: "AVAILABLE", count: 2, amount: 12.5 },
      { source: "ACTIVE_CONTRACT", status: "UNAVAILABLE", count: null, amount: null },
      { source: "PENDING_INVOICE", status: "AVAILABLE", count: 2, amount: null },
      { source: "ACTIVE_RECEIVABLE", status: "AVAILABLE", count: 2, amount: null },
      { source: "ACTIVE_RECEIVABLE_PLAN", status: "AVAILABLE", count: 2, amount: null },
      { source: "RETURN_VISIT", status: "AVAILABLE", count: 2, amount: null },
    ]);
  });

  it("rejects incomplete, duplicate, or mismatched responses", () => {
    expect(toCustomerBusinessOverview({ customerId: 9, cards: [] }, 8)).toBeNull();
    expect(
      toCustomerBusinessOverview(
        {
          customerId: 8,
          cards: customerBusinessOverviewSources.map((source) => ({
            source,
            status: "AVAILABLE",
            count: 0,
          })),
        },
        8,
      ),
    ).not.toBeNull();
    expect(
      toCustomerBusinessOverview(
        {
          customerId: 8,
          cards: customerBusinessOverviewSources.map(() => ({
            source: "CONTACT",
            status: "AVAILABLE",
            count: 0,
          })),
        },
        8,
      ),
    ).toBeNull();
  });
});
