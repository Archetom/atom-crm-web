import { describe, expect, it } from "vitest";

import { applyFieldLayout, decodeFieldLayout, groupFieldSections } from "./field-layout";
import type { FieldDefinition } from "./field-definition";

const definitions: FieldDefinition[] = [
  {
    code: "name",
    displayName: "名称",
    fieldType: "TEXT",
    builtin: true,
    required: true,
    searchable: true,
    status: "ACTIVE",
    displayOrder: 20,
    sectionName: "基本信息",
    options: [],
  },
  {
    code: "industry",
    displayName: "行业",
    fieldType: "SELECT",
    builtin: false,
    required: false,
    searchable: true,
    status: "ACTIVE",
    displayOrder: 10,
    sectionName: "业务信息",
    options: [],
  },
  {
    code: "legacy",
    displayName: "旧字段",
    fieldType: "TEXT",
    builtin: false,
    required: false,
    searchable: false,
    status: "INACTIVE",
    displayOrder: 0,
    sectionName: null,
    options: [],
  },
];

describe("field layout", () => {
  it("decodes known layout fields and orders only visible active definitions", () => {
    const layout = decodeFieldLayout({
      objectType: "CUSTOMER",
      orderedCodes: ["name", "name", "industry"],
      hiddenCodes: ["industry"],
      pinnedCodes: ["name"],
      columnWidths: { name: 240, ignored: -1 },
      version: 3,
    });

    expect(applyFieldLayout(definitions, layout)).toEqual([
      { definition: definitions[0], pinned: true, width: 240 },
    ]);
  });

  it("keeps sections in resolved layout order", () => {
    const layout = decodeFieldLayout({
      objectType: "CUSTOMER",
      orderedCodes: ["industry", "name"],
    });
    const sections = groupFieldSections(applyFieldLayout(definitions, layout));

    expect(sections.map((section) => section.name)).toEqual(["业务信息", "基本信息"]);
    expect(sections.map((section) => section.fields[0]?.definition.code)).toEqual([
      "industry",
      "name",
    ]);
  });
});
