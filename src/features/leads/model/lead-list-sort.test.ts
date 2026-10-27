import { describe, expect, it } from "vitest";

import type { FieldDefinition } from "~/components/dynamic-field";

import {
  defaultLeadListSort,
  leadCustomSortOptions,
  leadListSortFromSearch,
  resolveLeadListSort,
  withLeadListSort,
} from "./lead-list-sort";

function field(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    builtin: false,
    code: "engagement_score",
    displayName: "互动评分",
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

describe("lead list sorting", () => {
  it("restores only declared server-backed sort choices from the URL", () => {
    expect(leadListSortFromSearch("sort=name-asc")).toBe("name-asc");
    expect(leadListSortFromSearch("sort=custom%3Aengagement_score%3Adesc")).toBe(
      "custom:engagement_score:desc",
    );
    expect(leadListSortFromSearch("sort=custom-field-desc")).toBe(defaultLeadListSort);
    expect(leadListSortFromSearch("sort=custom%3Aengagement-score%3Aasc")).toBe(
      defaultLeadListSort,
    );
  });

  it("maps URL state to the generated lead query contract", () => {
    expect(withLeadListSort({ page: 2, size: 15 }, "owner-desc")).toEqual({
      page: 2,
      size: 15,
      sortDirection: "DESC",
      sortField: "OWNER_ACTOR",
    });
    expect(withLeadListSort({ page: 1 }, defaultLeadListSort)).toEqual({ page: 1 });
    expect(withLeadListSort({ page: 3 }, "custom:engagement_score:desc")).toEqual({
      customSortFieldCode: "engagement_score",
      page: 3,
      sortDirection: "DESC",
    });
  });

  it("only restores scalar custom fields from the current field catalogue", () => {
    const fields = [
      field(),
      field({ code: "lead_sources", fieldType: "MULTI_SELECT" }),
      field({ code: "inactive_score", status: "INACTIVE" }),
      field({ builtin: true, code: "lead_name" }),
    ];

    expect(leadCustomSortOptions(fields)).toEqual([
      { label: "互动评分：升序", value: "custom:engagement_score:asc" },
      { label: "互动评分：降序", value: "custom:engagement_score:desc" },
    ]);
    expect(resolveLeadListSort("custom:engagement_score:desc", fields)).toBe(
      "custom:engagement_score:desc",
    );
    expect(resolveLeadListSort("custom:lead_sources:asc", fields)).toBe(defaultLeadListSort);
  });
});
