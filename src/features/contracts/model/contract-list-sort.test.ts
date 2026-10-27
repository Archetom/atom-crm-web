import { describe, expect, it } from "vitest";

import type { FieldDefinition } from "~/components/dynamic-field";

import {
  contractCustomSortOptions,
  contractListSortFromSearch,
  defaultContractListSort,
  resolveContractListSort,
  withContractListSort,
} from "./contract-list-sort";

function field(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    builtin: false,
    code: "contract_rank",
    displayName: "合同排序值",
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

describe("contract list sorting", () => {
  it("restores only declared server-backed sort choices from the URL", () => {
    expect(contractListSortFromSearch("sort=name-asc")).toBe("name-asc");
    expect(contractListSortFromSearch("sort=custom%3Acontract_rank%3Adesc")).toBe(
      "custom:contract_rank:desc",
    );
    expect(contractListSortFromSearch("sort=amount-desc")).toBe(defaultContractListSort);
  });

  it("maps URL state to the generated contract query contract", () => {
    expect(withContractListSort({ page: 2, size: 15 }, "owner-desc")).toEqual({
      page: 2,
      size: 15,
      sortDirection: "DESC",
      sortField: "OWNER_ACTOR",
    });
    expect(withContractListSort({ page: 3 }, "custom:contract_rank:desc")).toEqual({
      customSortFieldCode: "contract_rank",
      page: 3,
      sortDirection: "DESC",
    });
    expect(withContractListSort({ page: 1 }, defaultContractListSort)).toEqual({ page: 1 });
  });

  it("only restores scalar custom fields from the current field catalogue", () => {
    const fields = [field(), field({ code: "contract_labels", fieldType: "MULTI_SELECT" })];

    expect(contractCustomSortOptions(fields)).toEqual([
      { label: "合同排序值：升序", value: "custom:contract_rank:asc" },
      { label: "合同排序值：降序", value: "custom:contract_rank:desc" },
    ]);
    expect(resolveContractListSort("custom:contract_rank:desc", fields)).toBe(
      "custom:contract_rank:desc",
    );
    expect(resolveContractListSort("custom:contract_labels:asc", fields)).toBe(
      defaultContractListSort,
    );
  });
});
