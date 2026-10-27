import { describe, expect, it } from "vitest";

import type { FieldDefinition } from "~/components/dynamic-field";

import {
  defaultReturnVisitListSort,
  resolveReturnVisitListSort,
  returnVisitCustomSortOptions,
  returnVisitListSortFromSearch,
  withReturnVisitListSort,
} from "./return-visit-list-sort";

function field(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    builtin: false,
    code: "visit_score",
    displayName: "回访评分",
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

describe("return visit list sorting", () => {
  it("restores only declared server-backed sort choices from the URL", () => {
    expect(returnVisitListSortFromSearch("sort=visit-time-asc")).toBe("visit-time-asc");
    expect(returnVisitListSortFromSearch("sort=custom%3Avisit_score%3Adesc")).toBe(
      "custom:visit_score:desc",
    );
    expect(returnVisitListSortFromSearch("sort=remark-desc")).toBe(defaultReturnVisitListSort);
    expect(returnVisitListSortFromSearch("sort=custom%3Avisit-score%3Aasc")).toBe(
      defaultReturnVisitListSort,
    );
  });

  it("maps URL state to the generated return-visit query contract", () => {
    expect(withReturnVisitListSort({ page: 2, size: 15 }, "number-desc")).toEqual({
      page: 2,
      size: 15,
      sortDirection: "DESC",
      sortField: "VISIT_NUMBER",
    });
    expect(withReturnVisitListSort({ page: 1 }, defaultReturnVisitListSort)).toEqual({ page: 1 });
    expect(withReturnVisitListSort({ page: 3 }, "custom:visit_score:desc")).toEqual({
      customSortFieldCode: "visit_score",
      page: 3,
      sortDirection: "DESC",
    });
  });

  it("only restores scalar custom fields from the current field catalogue", () => {
    const fields = [
      field(),
      field({ code: "visit_labels", fieldType: "MULTI_SELECT" }),
      field({ code: "inactive_score", status: "INACTIVE" }),
      field({ builtin: true, code: "visit_number" }),
    ];

    expect(returnVisitCustomSortOptions(fields)).toEqual([
      { label: "回访评分：升序", value: "custom:visit_score:asc" },
      { label: "回访评分：降序", value: "custom:visit_score:desc" },
    ]);
    expect(resolveReturnVisitListSort("custom:visit_score:desc", fields)).toBe(
      "custom:visit_score:desc",
    );
    expect(resolveReturnVisitListSort("custom:visit_labels:asc", fields)).toBe(
      defaultReturnVisitListSort,
    );
  });
});
