import { Form } from "antd";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomFieldFormFields } from "./custom-field-form-fields";
import type { FieldDefinition } from "../model/field-definition";

afterEach(cleanup);

const definitions: readonly FieldDefinition[] = [
  {
    builtin: false,
    code: "source",
    displayName: "来源",
    displayOrder: 1,
    fieldType: "TEXT",
    options: [],
    required: false,
    searchable: false,
    sectionName: null,
    status: "ACTIVE",
  },
];

describe("CustomFieldFormFields", () => {
  it("records an intentional clear for a blank-starting edit form", () => {
    const onChange = vi.fn();
    const onFieldChange = vi.fn();

    render(
      <Form layout="vertical">
        <CustomFieldFormFields
          definitions={definitions}
          disabled={false}
          showExplicitClear
          values={{ source: ["server value"] }}
          onChange={onChange}
          onFieldChange={onFieldChange}
        />
      </Form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "清空来源" }));

    expect(onChange).toHaveBeenCalledWith({});
    expect(onFieldChange).toHaveBeenCalledWith("source");
  });
});
