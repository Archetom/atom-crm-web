import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { customFieldTypes, type FieldDefinition } from "../model/field-definition";
import { formatDynamicFieldDisplay } from "../model/field-display";
import { DynamicFieldDisplay } from "./dynamic-field-display";

function field(fieldType: FieldDefinition["fieldType"]): FieldDefinition {
  return {
    code: "custom",
    displayName: "自定义字段",
    fieldType,
    builtin: false,
    required: false,
    searchable: true,
    status: "ACTIVE",
    displayOrder: 0,
    sectionName: null,
    options: [{ value: "option", label: "选项", order: 0 }],
  };
}

describe("formatDynamicFieldDisplay", () => {
  it("covers every server-defined field type", () => {
    for (const fieldType of customFieldTypes) {
      const display = formatDynamicFieldDisplay(field(fieldType), ["option"], {
        level: "READ",
        maskType: "NONE",
      });

      if (fieldType === "URL") expect(display.kind).toBe("text");
      else if (fieldType === "FILE")
        expect(display).toEqual({ kind: "text", text: "已关联 1 个文件" });
      else if (fieldType === "BOOLEAN") expect(display).toEqual({ kind: "text", text: "option" });
      else if (fieldType === "SELECT" || fieldType === "MULTI_SELECT") {
        expect(display).toEqual({ kind: "text", text: "选项" });
      } else expect(display).toEqual({ kind: "text", text: "option" });
    }
  });

  it("does not inspect values when hidden or fully masked", () => {
    expect(
      formatDynamicFieldDisplay(field("TEXT"), ["绝不能展示"], {
        level: "HIDDEN",
        maskType: "NONE",
      }),
    ).toEqual({ kind: "hidden" });
    expect(
      formatDynamicFieldDisplay(field("TEXT"), ["绝不能展示"], {
        level: "READ",
        maskType: "FULL",
      }),
    ).toEqual({ kind: "masked", text: "已脱敏" });
  });

  it("uses option labels and converts booleans without reconstructing masks", () => {
    expect(
      formatDynamicFieldDisplay(field("MULTI_SELECT"), ["option", "unknown"], {
        level: "WRITE",
        maskType: "PARTIAL",
      }),
    ).toEqual({ kind: "text", text: "选项、unknown" });
    expect(
      formatDynamicFieldDisplay(field("BOOLEAN"), ["true"], {
        level: "READ",
        maskType: "NONE",
      }),
    ).toEqual({ kind: "text", text: "是" });
  });

  it("only turns safe HTTP(S) URLs into links", () => {
    render(
      <>
        <DynamicFieldDisplay
          access={{ level: "READ", maskType: "NONE" }}
          field={field("URL")}
          values={["https://example.test/customer"]}
        />
        <DynamicFieldDisplay
          access={{ level: "READ", maskType: "NONE" }}
          field={field("URL")}
          values={["javascript:alert(1)"]}
        />
      </>,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.test/customer");
    expect(screen.getByText("javascript:alert(1)").closest("a")).toBeNull();
  });

  it("renders neither hidden nor fully masked raw values", () => {
    render(
      <>
        <DynamicFieldDisplay
          access={{ level: "HIDDEN", maskType: "NONE" }}
          field={field("TEXT")}
          values={["不可展示"]}
        />
        <DynamicFieldDisplay
          access={{ level: "READ", maskType: "FULL" }}
          field={field("TEXT")}
          values={["不可展示"]}
        />
      </>,
    );

    expect(screen.queryByText("不可展示")).not.toBeInTheDocument();
    expect(screen.getByText("已脱敏")).toBeInTheDocument();
  });
});
