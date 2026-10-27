import { describe, expect, it } from "vitest";

import { selectedInvoiceIdFromSearch } from "./invoice-list-route";

describe("invoice list detail selection", () => {
  it("restores only a positive safe invoice ID from the list URL", () => {
    expect(selectedInvoiceIdFromSearch("keyword=tax&invoiceId=42")).toBe(42);
    expect(selectedInvoiceIdFromSearch("invoiceId=0")).toBeNull();
    expect(selectedInvoiceIdFromSearch("invoiceId=-42")).toBeNull();
    expect(selectedInvoiceIdFromSearch("invoiceId=42.5")).toBeNull();
    expect(selectedInvoiceIdFromSearch("invoiceId=9007199254740992")).toBeNull();
  });
});
