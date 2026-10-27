import { describe, expect, it } from "vitest";

import type { FieldDefinition } from "~/components/dynamic-field";

import {
  defaultOpportunityListSort,
  opportunityCustomSortOptions,
  opportunityListSortFromSearch,
  resolveOpportunityListSort,
  withOpportunityListSort,
} from "./opportunity-list-sort";

function field(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    builtin: false,
    code: "forecast_score",
    displayName: "预测评分",
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

describe("opportunity list sorting", () => {
  it("restores only declared server-backed sort choices from the URL", () => {
    expect(opportunityListSortFromSearch("sort=name-asc")).toBe("name-asc");
    expect(opportunityListSortFromSearch("sort=custom%3Aforecast_score%3Adesc")).toBe(
      "custom:forecast_score:desc",
    );
    expect(opportunityListSortFromSearch("sort=custom-field-desc")).toBe(
      defaultOpportunityListSort,
    );
    expect(opportunityListSortFromSearch("sort=custom%3Aforecast-score%3Aasc")).toBe(
      defaultOpportunityListSort,
    );
  });

  it("maps URL state to the generated opportunity query contract", () => {
    expect(withOpportunityListSort({ page: 2, size: 15 }, "owner-desc")).toEqual({
      page: 2,
      size: 15,
      sortDirection: "DESC",
      sortField: "OWNER_ACTOR",
    });
    expect(withOpportunityListSort({ page: 1 }, defaultOpportunityListSort)).toEqual({ page: 1 });
    expect(withOpportunityListSort({ page: 3 }, "custom:forecast_score:desc")).toEqual({
      customSortFieldCode: "forecast_score",
      page: 3,
      sortDirection: "DESC",
    });
  });

  it("only restores scalar custom fields from the current field catalogue", () => {
    const fields = [
      field(),
      field({ code: "opportunity_sources", fieldType: "MULTI_SELECT" }),
      field({ code: "inactive_score", status: "INACTIVE" }),
      field({ builtin: true, code: "opportunity_name" }),
    ];

    expect(opportunityCustomSortOptions(fields)).toEqual([
      { label: "预测评分：升序", value: "custom:forecast_score:asc" },
      { label: "预测评分：降序", value: "custom:forecast_score:desc" },
    ]);
    expect(resolveOpportunityListSort("custom:forecast_score:desc", fields)).toBe(
      "custom:forecast_score:desc",
    );
    expect(resolveOpportunityListSort("custom:opportunity_sources:asc", fields)).toBe(
      defaultOpportunityListSort,
    );
  });
});
