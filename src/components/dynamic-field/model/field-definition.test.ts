import { describe, expect, it } from "vitest";

import {
  decodeFieldDefinitions,
  hasFieldAccess,
  type EffectiveFieldAccess,
} from "./field-definition";

describe("decodeFieldDefinitions", () => {
  it("keeps only a narrow valid presentation projection", () => {
    const definitions = decodeFieldDefinitions([
      {
        code: "industry",
        displayName: "行业",
        fieldType: "SELECT",
        builtin: true,
        required: true,
        searchable: true,
        status: "ACTIVE",
        displayOrder: 4,
        sectionName: "基本信息",
        options: [
          { value: "software", label: "软件", order: 2, unknown: "ignored" },
          { value: 3, label: "无效" },
        ],
        description: "not retained",
      },
      {
        code: "industry",
        displayName: "重复字段",
        fieldType: "TEXT",
        status: "ACTIVE",
      },
      {
        code: "unsupported",
        displayName: "未知类型",
        fieldType: "SECRET",
        status: "ACTIVE",
      },
    ]);

    expect(definitions).toEqual([
      {
        code: "industry",
        displayName: "行业",
        fieldType: "SELECT",
        builtin: true,
        required: true,
        searchable: true,
        status: "ACTIVE",
        displayOrder: 4,
        sectionName: "基本信息",
        options: [{ value: "software", label: "软件", order: 2 }],
      },
    ]);
  });

  it("rejects non-list payloads", () => {
    expect(() => decodeFieldDefinitions({})).toThrow("字段配置数据暂时不可用");
  });
});

describe("hasFieldAccess", () => {
  const access: EffectiveFieldAccess = { level: "WRITE", maskType: "NONE" };

  it("uses only the explicitly supplied effective level", () => {
    expect(hasFieldAccess(access, "READ")).toBe(true);
    expect(hasFieldAccess(access, "WRITE")).toBe(true);
    expect(hasFieldAccess({ level: "HIDDEN", maskType: "NONE" }, "READ")).toBe(false);
  });
});
