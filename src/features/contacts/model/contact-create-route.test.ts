import { describe, expect, it } from "vitest";

import { contactCreateRouteContextFromSearch } from "./contact-create-route";

describe("contact create route context", () => {
  it("keeps only a matching positive customer and customer-detail return path", () => {
    expect(
      contactCreateRouteContextFromSearch("customerId=8&returnTo=%2Fcrm%2Fcustomers%2F8"),
    ).toEqual({ customerId: 8, returnPath: "/crm/customers/8" });
  });

  it("fails closed for malformed identifiers and unrelated return paths", () => {
    expect(contactCreateRouteContextFromSearch("customerId=8&returnTo=%2Fcrm%2Fcontacts")).toEqual({
      customerId: 8,
      returnPath: null,
    });
    expect(
      contactCreateRouteContextFromSearch("customerId=8.2&returnTo=%2Fcrm%2Fcustomers%2F8"),
    ).toEqual({
      customerId: null,
      returnPath: null,
    });
  });

  it("allows a customer context without a return path while retaining no redirect target", () => {
    expect(contactCreateRouteContextFromSearch("customerId=8")).toEqual({
      customerId: 8,
      returnPath: null,
    });
  });
});
