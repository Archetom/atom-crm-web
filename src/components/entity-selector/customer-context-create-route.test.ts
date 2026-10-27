import { describe, expect, it } from "vitest";

import {
  customerContextGlobalBatchCreatePath,
  customerContextGlobalCreatePath,
  customerContextGlobalDetailPath,
  customerContextGlobalListPath,
  customerContextNestedCreatePath,
  customerContextPlanReceivableCreatePath,
  customerContextReceivableRequestedPlanId,
  customerContextReceivableReturnPath,
} from "./customer-context-create-route";

describe("customer-context global creation routes", () => {
  it("preserves a list query through the customer-context form", () => {
    const globalPath = customerContextGlobalCreatePath(
      "/crm/contracts",
      "?keyword=renewal&page=3&sort=name-asc",
    );

    expect(globalPath).toBe(
      "/crm/contracts/new?returnTo=%3Fkeyword%3Drenewal%26page%3D3%26sort%3Dname-asc",
    );
    expect(
      customerContextNestedCreatePath(
        "/crm/customers/8/contracts/new",
        globalPath.split("?")[1] ?? "",
      ),
    ).toBe(
      "/crm/customers/8/contracts/new?returnTo=%3Fkeyword%3Drenewal%26page%3D3%26sort%3Dname-asc",
    );
    expect(
      customerContextGlobalListPath(
        "/crm/contracts",
        "returnTo=%3Fkeyword%3Drenewal%26page%3D3%26sort%3Dname-asc",
      ),
    ).toBe("/crm/contracts?keyword=renewal&page=3&sort=name-asc");
  });

  it("keeps the destination static and rejects path or fragment values", () => {
    expect(customerContextGlobalListPath("/crm/invoices", "returnTo=")).toBe("/crm/invoices");
    expect(
      customerContextGlobalListPath("/crm/invoices", "returnTo=%2Fcrm%2Fcustomers"),
    ).toBeNull();
    expect(
      customerContextGlobalListPath("/crm/invoices", "returnTo=%3Fkeyword%3Done%23other"),
    ).toBeNull();
    expect(customerContextGlobalListPath("/crm/invoices", "")).toBeNull();
  });

  it("uses the fixed batch-create entry while preserving the global list query", () => {
    expect(
      customerContextGlobalBatchCreatePath("/crm/receivable-plans", "?scene=mine&page=2"),
    ).toBe("/crm/receivable-plans/batch-new?returnTo=%3Fscene%3Dmine%26page%3D2");
  });

  it("carries only a list query into the fixed customer-context detail route", () => {
    expect(
      customerContextGlobalDetailPath(
        "/crm/customers/8/receivable-plans/5",
        "?customerId=8&page=2",
      ),
    ).toBe("/crm/customers/8/receivable-plans/5?returnTo=%3FcustomerId%3D8%26page%3D2");
  });

  it("uses a fixed return target for the receivable action from a plan row", () => {
    const path = customerContextPlanReceivableCreatePath(8, 5, "?scene=mine&page=2");

    expect(path).toBe(
      "/crm/customers/8/receivables/new?planId=5&returnTarget=receivable-plans&returnTo=%3Fscene%3Dmine%26page%3D2",
    );
    const search = path.split("?")[1] ?? "";
    expect(customerContextReceivableReturnPath(search)).toBe(
      "/crm/receivable-plans?scene=mine&page=2",
    );
    expect(customerContextReceivableRequestedPlanId(search)).toBe(5);
  });

  it("rejects unknown receivable return targets and invalid plan IDs", () => {
    expect(
      customerContextReceivableReturnPath("returnTarget=external&returnTo=%3Fpage%3D2"),
    ).toBeNull();
    expect(customerContextReceivableRequestedPlanId("planId=0")).toBeNull();
    expect(customerContextReceivableRequestedPlanId("planId=1.5")).toBeNull();
    expect(customerContextReceivableRequestedPlanId("returnTarget=external&planId=5")).toBeNull();
  });
});
