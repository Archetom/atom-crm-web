import { describe, expect, it } from "vitest";

import type { FieldDefinition } from "~/components/dynamic-field";

import {
  contactCustomSortOptions,
  contactListSortFromSearch,
  defaultContactListSort,
  resolveContactListSort,
  withContactListSort,
} from "./contact-list-sort";

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

describe("contact list sorting", () => {
  it("restores only declared server-backed sort choices from the URL", () => {
    expect(contactListSortFromSearch("sort=name-asc")).toBe("name-asc");
    expect(contactListSortFromSearch("sort=custom%3Aengagement_score%3Adesc")).toBe(
      "custom:engagement_score:desc",
    );
    expect(contactListSortFromSearch("sort=custom-field-desc")).toBe(defaultContactListSort);
    expect(contactListSortFromSearch("sort=custom%3Aengagement-score%3Aasc")).toBe(
      defaultContactListSort,
    );
  });

  it("maps URL state to the generated contact query contract", () => {
    expect(withContactListSort({ page: 2, size: 15 }, "owner-desc")).toEqual({
      page: 2,
      size: 15,
      sortDirection: "DESC",
      sortField: "OWNER_ACTOR",
    });
    expect(withContactListSort({ page: 1 }, defaultContactListSort)).toEqual({ page: 1 });
    expect(withContactListSort({ page: 3 }, "custom:engagement_score:desc")).toEqual({
      customSortFieldCode: "engagement_score",
      page: 3,
      sortDirection: "DESC",
    });
  });

  it("only restores scalar custom fields from the current field catalogue", () => {
    const fields = [
      field(),
      field({ code: "contact_sources", fieldType: "MULTI_SELECT" }),
      field({ code: "inactive_score", status: "INACTIVE" }),
      field({ builtin: true, code: "contact_name" }),
    ];

    expect(contactCustomSortOptions(fields)).toEqual([
      { label: "互动评分：升序", value: "custom:engagement_score:asc" },
      { label: "互动评分：降序", value: "custom:engagement_score:desc" },
    ]);
    expect(resolveContactListSort("custom:engagement_score:desc", fields)).toBe(
      "custom:engagement_score:desc",
    );
    expect(resolveContactListSort("custom:contact_sources:asc", fields)).toBe(
      defaultContactListSort,
    );
  });
});
