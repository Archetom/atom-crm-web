import { describe, expect, it } from "vitest";

import type { FieldDefinition } from "~/components/dynamic-field";

import { dynamicListColumnOptions, dynamicListColumns } from "./dynamic-list-columns";

const field = (overrides: Partial<FieldDefinition> = {}): FieldDefinition => ({
  builtin: false,
  code: "cf_industry",
  displayName: "行业",
  displayOrder: 1,
  fieldType: "SELECT",
  options: [{ label: "制造业", order: 1, value: "manufacturing" }],
  required: false,
  searchable: true,
  sectionName: null,
  status: "ACTIVE",
  ...overrides,
});

describe("dynamic list columns", () => {
  it("offers only active, non-file custom fields and uses their server-owned codes", () => {
    const definitions = [
      field(),
      field({ builtin: true, code: "name", displayName: "名称" }),
      field({ code: "cf_files", displayName: "资料", fieldType: "FILE" }),
      field({ code: "cf_closed", displayName: "已停用", status: "INACTIVE" }),
      field({ code: "customer_name", displayName: "冲突字段" }),
    ];

    expect(dynamicListColumnOptions(definitions, ["customer_name"])).toEqual([
      { code: "cf_industry", label: "行业" },
    ]);
    expect(dynamicListColumns(definitions, ["customer_name"]).map((column) => column.key)).toEqual([
      "cf_industry",
    ]);
  });
});
