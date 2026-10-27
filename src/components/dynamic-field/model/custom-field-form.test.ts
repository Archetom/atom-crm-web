import { describe, expect, it } from "vitest";

import {
  customFileFieldDefinitions,
  customFieldFormDefinitions,
  toCustomFieldFormValues,
  unsupportedRequiredCustomFieldDefinitions,
  validateCustomFieldFormValues,
} from "./custom-field-form";
import type { FieldDefinition } from "./field-definition";

const definitions: readonly FieldDefinition[] = [
  {
    code: "cf_source",
    displayName: "客户来源",
    fieldType: "SELECT",
    builtin: false,
    required: true,
    searchable: true,
    status: "ACTIVE",
    displayOrder: 2,
    sectionName: "基本信息",
    options: [
      { value: "direct", label: "自主开发", order: 0 },
      { value: "referral", label: "转介绍", order: 1 },
    ],
  },
  {
    code: "cf_scale",
    displayName: "年潜在体量",
    fieldType: "DECIMAL",
    builtin: false,
    required: false,
    searchable: true,
    status: "ACTIVE",
    displayOrder: 3,
    sectionName: "基本信息",
    options: [],
  },
  {
    code: "cf_files",
    displayName: "资质附件",
    fieldType: "FILE",
    builtin: false,
    required: false,
    searchable: false,
    status: "ACTIVE",
    displayOrder: 4,
    sectionName: null,
    options: [],
  },
  {
    code: "cf_account_manager",
    displayName: "客户经理",
    fieldType: "USER",
    builtin: false,
    required: false,
    searchable: true,
    status: "ACTIVE",
    displayOrder: 5,
    sectionName: "基本信息",
    options: [],
  },
  {
    code: "cf_region_department",
    displayName: "归属部门",
    fieldType: "DEPARTMENT",
    builtin: false,
    required: false,
    searchable: true,
    status: "ACTIVE",
    displayOrder: 6,
    sectionName: "基本信息",
    options: [],
  },
  {
    code: "name",
    displayName: "客户名称",
    fieldType: "TEXT",
    builtin: true,
    required: true,
    searchable: true,
    status: "ACTIVE",
    displayOrder: 0,
    sectionName: "基本信息",
    options: [],
  },
];

describe("custom field form", () => {
  it("uses only active, non-builtin fields with a safe create control", () => {
    expect(customFieldFormDefinitions(definitions).map((field) => field.code)).toEqual([
      "cf_source",
      "cf_scale",
      "cf_account_manager",
      "cf_region_department",
    ]);
  });

  it("keeps FILE fields out of scalar values and blocks required RELATION fields", () => {
    expect(customFileFieldDefinitions(definitions).map((field) => field.code)).toEqual([
      "cf_files",
    ]);
    expect(
      unsupportedRequiredCustomFieldDefinitions(
        definitions.map((field) =>
          field.code === "cf_files"
            ? { ...field, fieldType: "RELATION" as const, required: true }
            : field,
        ),
      ).map((field) => field.code),
    ).toEqual(["cf_files"]);
  });

  it("serializes only catalog-backed, nonblank values", () => {
    expect(
      toCustomFieldFormValues(definitions, {
        cf_source: [" direct ", "direct"],
        cf_scale: [" 12.50 "],
        cf_account_manager: [" 12 "],
        cf_region_department: [" 9 "],
        cf_files: ["must not be submitted as a scalar"],
        unknown: ["must not be submitted"],
      }),
    ).toEqual({
      cf_source: ["direct"],
      cf_scale: ["12.50"],
      cf_account_manager: ["12"],
      cf_region_department: ["9"],
    });
  });

  it("reports reviewed client validation while leaving final enforcement to the server", () => {
    expect(validateCustomFieldFormValues(definitions, {})).toEqual([
      { code: "cf_source", message: "客户来源为必填项" },
    ]);
    expect(
      validateCustomFieldFormValues(definitions, {
        cf_source: ["unknown"],
        cf_scale: ["not-a-number"],
        cf_account_manager: ["not-an-id"],
        cf_region_department: ["0"],
      }),
    ).toEqual([
      { code: "cf_source", message: "客户来源包含无效选项" },
      { code: "cf_scale", message: "年潜在体量请输入小数" },
      { code: "cf_account_manager", message: "客户经理包含无效候选项" },
      { code: "cf_region_department", message: "归属部门包含无效候选项" },
    ]);
    expect(
      validateCustomFieldFormValues(definitions, {
        cf_source: ["direct"],
        cf_scale: ["12.50"],
        cf_account_manager: ["12"],
        cf_region_department: ["9"],
      }),
    ).toEqual([]);
  });
});
