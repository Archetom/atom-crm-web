import { describe, expect, it } from "vitest";

import type { FieldDefinition } from "~/components/dynamic-field";

import {
  defaultProductListSort,
  productCustomSortOptions,
  productListSortFromSearch,
  resolveProductListSort,
  withProductListSort,
} from "./product-list-sort";

function field(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    builtin: false,
    code: "catalog_rank",
    displayName: "目录排序值",
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

describe("product list sorting", () => {
  it("restores only declared server-backed sort choices from the URL", () => {
    expect(productListSortFromSearch("sort=name-asc")).toBe("name-asc");
    expect(productListSortFromSearch("sort=custom%3Acatalog_rank%3Adesc")).toBe(
      "custom:catalog_rank:desc",
    );
    expect(productListSortFromSearch("sort=list-price-desc")).toBe(defaultProductListSort);
    expect(productListSortFromSearch("sort=custom%3Acatalog-rank%3Aasc")).toBe(
      defaultProductListSort,
    );
  });

  it("maps URL state to the generated product query contract", () => {
    expect(withProductListSort({ page: 2, size: 15 }, "owner-desc")).toEqual({
      page: 2,
      size: 15,
      sortDirection: "DESC",
      sortField: "OWNER_ACTOR",
    });
    expect(withProductListSort({ page: 1 }, defaultProductListSort)).toEqual({ page: 1 });
    expect(withProductListSort({ page: 3 }, "custom:catalog_rank:desc")).toEqual({
      customSortFieldCode: "catalog_rank",
      page: 3,
      sortDirection: "DESC",
    });
  });

  it("only restores scalar custom fields from the current field catalogue", () => {
    const fields = [
      field(),
      field({ code: "product_labels", fieldType: "MULTI_SELECT" }),
      field({ code: "inactive_rank", status: "INACTIVE" }),
      field({ builtin: true, code: "product_name" }),
    ];

    expect(productCustomSortOptions(fields)).toEqual([
      { label: "目录排序值：升序", value: "custom:catalog_rank:asc" },
      { label: "目录排序值：降序", value: "custom:catalog_rank:desc" },
    ]);
    expect(resolveProductListSort("custom:catalog_rank:desc", fields)).toBe(
      "custom:catalog_rank:desc",
    );
    expect(resolveProductListSort("custom:product_labels:asc", fields)).toBe(
      defaultProductListSort,
    );
  });
});
