import { describe, expect, it } from "vitest";

import type { FieldDefinition } from "~/components/dynamic-field";

import {
  defaultInvoiceListSort,
  invoiceCustomSortOptions,
  invoiceListSortFromSearch,
  resolveInvoiceListSort,
  withInvoiceListSort,
} from "./invoice-list-sort";

function field(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    builtin: false,
    code: "invoice_rank",
    displayName: "发票排序值",
    displayOrder: 1,
    fieldType: "INTEGER",
    options: [],
    required: false,
    searchable: true,
    sectionName: null,
    status: "ACTIVE",
    ...overrides,
  };
}

describe("invoice list sorting", () => {
  it("restores only declared server-backed sort choices from the URL", () => {
    expect(invoiceListSortFromSearch("sort=issued-date-asc")).toBe("issued-date-asc");
    expect(invoiceListSortFromSearch("sort=custom%3Ainvoice_rank%3Aasc")).toBe(
      "custom:invoice_rank:asc",
    );
    expect(invoiceListSortFromSearch("sort=amount-desc")).toBe(defaultInvoiceListSort);
  });

  it("maps URL state to the generated invoice query contract", () => {
    expect(withInvoiceListSort({ page: 2, size: 15 }, "invoice-number-desc")).toEqual({
      page: 2,
      size: 15,
      sortDirection: "DESC",
      sortField: "INVOICE_NUMBER",
    });
    expect(withInvoiceListSort({ page: 3 }, "custom:invoice_rank:asc")).toEqual({
      customSortFieldCode: "invoice_rank",
      page: 3,
      sortDirection: "ASC",
    });
    expect(withInvoiceListSort({ page: 1 }, defaultInvoiceListSort)).toEqual({ page: 1 });
  });

  it("only restores scalar custom fields from the current field catalogue", () => {
    const fields = [field(), field({ code: "invoice_labels", fieldType: "MULTI_SELECT" })];

    expect(invoiceCustomSortOptions(fields)).toEqual([
      { label: "发票排序值：升序", value: "custom:invoice_rank:asc" },
      { label: "发票排序值：降序", value: "custom:invoice_rank:desc" },
    ]);
    expect(resolveInvoiceListSort("custom:invoice_rank:asc", fields)).toBe(
      "custom:invoice_rank:asc",
    );
    expect(resolveInvoiceListSort("custom:invoice_labels:asc", fields)).toBe(
      defaultInvoiceListSort,
    );
  });
});
