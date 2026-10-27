import { describe, expect, it } from "vitest";

import {
  customerCustomSortOptions,
  customerListSortFromSearch,
  defaultCustomerListSort,
  resolveCustomerListSort,
  withCustomerListSort,
} from "./customer-list-sort";
import type { FieldDefinition } from "~/components/dynamic-field";

function field(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    builtin: false,
    code: "annual_revenue",
    displayName: "年营收",
    displayOrder: 1,
    fieldType: "DECIMAL",
    options: [],
    required: false,
    searchable: true,
    sectionName: null,
    status: "ACTIVE",
    ...overrides,
  };
}

describe("customer list sorting", () => {
  it("restores only declared server-backed sort choices from the URL", () => {
    expect(customerListSortFromSearch("sort=name-asc")).toBe("name-asc");
    expect(customerListSortFromSearch("sort=custom%3Aannual_revenue%3Aasc")).toBe(
      "custom:annual_revenue:asc",
    );
    expect(customerListSortFromSearch("sort=custom-field-desc")).toBe(defaultCustomerListSort);
    expect(customerListSortFromSearch("sort=custom%3Aannual-revenue%3Aasc")).toBe(
      defaultCustomerListSort,
    );
  });

  it("maps URL state to the generated customer query contract", () => {
    expect(withCustomerListSort({ page: 2, size: 15 }, "owner-desc")).toEqual({
      page: 2,
      size: 15,
      sortDirection: "DESC",
      sortField: "OWNER_ACTOR",
    });
    expect(withCustomerListSort({ page: 1 }, defaultCustomerListSort)).toEqual({ page: 1 });
    expect(withCustomerListSort({ page: 3 }, "custom:annual_revenue:asc")).toEqual({
      customSortFieldCode: "annual_revenue",
      page: 3,
      sortDirection: "ASC",
    });
  });

  it("only restores and offers scalar custom fields from the current field catalogue", () => {
    const fields = [
      field(),
      field({ code: "multi_region", fieldType: "MULTI_SELECT" }),
      field({ code: "inactive_score", status: "INACTIVE" }),
      field({ builtin: true, code: "customer_name" }),
    ];

    expect(customerCustomSortOptions(fields)).toEqual([
      { label: "年营收：升序", value: "custom:annual_revenue:asc" },
      { label: "年营收：降序", value: "custom:annual_revenue:desc" },
    ]);
    expect(resolveCustomerListSort("custom:annual_revenue:asc", fields)).toBe(
      "custom:annual_revenue:asc",
    );
    expect(resolveCustomerListSort("custom:multi_region:desc", fields)).toBe(
      defaultCustomerListSort,
    );
  });
});
