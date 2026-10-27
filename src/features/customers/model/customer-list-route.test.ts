import { describe, expect, it } from "vitest";

import { selectedCustomerIdFromSearch } from "./customer-list-route";

describe("customer detail route", () => {
  it("accepts only a decimal positive safe selected ID", () => {
    expect(selectedCustomerIdFromSearch("customerId=42")).toBe(42);
    expect(selectedCustomerIdFromSearch("customerId=1e2")).toBeNull();
    expect(selectedCustomerIdFromSearch("customerId=0")).toBeNull();
    expect(selectedCustomerIdFromSearch("customerId=-1")).toBeNull();
    expect(selectedCustomerIdFromSearch("customerId=999999999999999999999")).toBeNull();
  });
});
