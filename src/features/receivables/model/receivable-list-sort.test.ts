import { describe, expect, it } from "vitest";

import type { FieldDefinition } from "~/components/dynamic-field";

import {
  defaultReceivableListSort,
  receivableCustomSortOptions,
  receivableListSortFromSearch,
  resolveReceivableListSort,
  withReceivableListSort,
} from "./receivable-list-sort";

function field(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    builtin: false,
    code: "receipt_rank",
    displayName: "回款排序值",
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

describe("receivable list sorting", () => {
  it("restores only declared server-backed sort choices from the URL", () => {
    expect(receivableListSortFromSearch("sort=received-date-asc")).toBe("received-date-asc");
    expect(receivableListSortFromSearch("sort=custom%3Areceipt_rank%3Adesc")).toBe(
      "custom:receipt_rank:desc",
    );
    expect(receivableListSortFromSearch("sort=amount-desc")).toBe(defaultReceivableListSort);
    expect(receivableListSortFromSearch("sort=custom%3Areceipt-rank%3Aasc")).toBe(
      defaultReceivableListSort,
    );
  });

  it("maps URL state to the generated receivable query contract", () => {
    expect(withReceivableListSort({ page: 2, size: 15 }, "number-desc")).toEqual({
      page: 2,
      size: 15,
      sortDirection: "DESC",
      sortField: "RECEIPT_NUMBER",
    });
    expect(withReceivableListSort({ page: 1 }, defaultReceivableListSort)).toEqual({ page: 1 });
    expect(withReceivableListSort({ page: 3 }, "custom:receipt_rank:desc")).toEqual({
      customSortFieldCode: "receipt_rank",
      page: 3,
      sortDirection: "DESC",
    });
  });

  it("only restores scalar custom fields from the current field catalogue", () => {
    const fields = [
      field(),
      field({ code: "receipt_labels", fieldType: "MULTI_SELECT" }),
      field({ code: "inactive_rank", status: "INACTIVE" }),
      field({ builtin: true, code: "receipt_number" }),
    ];

    expect(receivableCustomSortOptions(fields)).toEqual([
      { label: "回款排序值：升序", value: "custom:receipt_rank:asc" },
      { label: "回款排序值：降序", value: "custom:receipt_rank:desc" },
    ]);
    expect(resolveReceivableListSort("custom:receipt_rank:desc", fields)).toBe(
      "custom:receipt_rank:desc",
    );
    expect(resolveReceivableListSort("custom:receipt_labels:asc", fields)).toBe(
      defaultReceivableListSort,
    );
  });
});
