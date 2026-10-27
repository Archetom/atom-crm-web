import { describe, expect, it } from "vitest";

import type { FieldDefinition } from "./field-definition";
import {
  formatServerProvidedDynamicField,
  serverProvidedDynamicFields,
} from "./server-provided-dynamic-field";

function field(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    builtin: false,
    code: "cf_source",
    displayName: "客户来源",
    displayOrder: 1,
    fieldType: "SELECT",
    options: [{ label: "线上活动", order: 1, value: "campaign" }],
    required: false,
    searchable: true,
    sectionName: null,
    status: "ACTIVE",
    ...overrides,
  };
}

describe("serverProvidedDynamicFields", () => {
  it("uses only active non-FILE definitions to name values already returned by the server", () => {
    expect(
      serverProvidedDynamicFields(
        [
          field(),
          field({ code: "cf_file", fieldType: "FILE" }),
          field({ code: "cf_inactive", status: "INACTIVE" }),
          field({ builtin: true, code: "name" }),
        ],
        {
          cf_file: ["18"],
          cf_inactive: ["legacy"],
          cf_source: ["campaign"],
          name: ["不应显示"],
          unknown: ["不猜测标题"],
        },
      ),
    ).toEqual([{ field: field(), values: ["campaign"] }]);
  });

  it("preserves server-masked values and does not turn them into editable state", () => {
    expect(formatServerProvidedDynamicField(field({ fieldType: "TEXT" }), ["[REDACTED]"])).toEqual({
      kind: "text",
      text: "[REDACTED]",
    });
  });

  it("formats enum, boolean, and only safe external URL values", () => {
    expect(formatServerProvidedDynamicField(field(), ["campaign"])).toEqual({
      kind: "text",
      text: "线上活动",
    });
    expect(
      formatServerProvidedDynamicField(field({ fieldType: "BOOLEAN" }), ["true", "false"]),
    ).toEqual({ kind: "text", text: "是、否" });
    expect(
      formatServerProvidedDynamicField(field({ fieldType: "URL" }), ["javascript:alert(1)"]),
    ).toEqual({ kind: "text", text: "javascript:alert(1)" });
    expect(
      formatServerProvidedDynamicField(field({ fieldType: "URL" }), ["https://example.com/path"]),
    ).toEqual({ href: "https://example.com/path", kind: "link", text: "https://example.com/path" });
  });
});
