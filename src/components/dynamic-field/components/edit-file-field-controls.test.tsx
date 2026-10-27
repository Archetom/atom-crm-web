import { Form } from "antd";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditFileFieldControls } from "./edit-file-field-controls";
import type { FieldDefinition } from "../model/field-definition";

afterEach(cleanup);

const definitions: readonly FieldDefinition[] = [
  {
    builtin: false,
    code: "qualification",
    displayName: "资质文件",
    displayOrder: 1,
    fieldType: "FILE",
    options: [],
    required: false,
    searchable: false,
    sectionName: null,
    status: "ACTIVE",
  },
];

describe("EditFileFieldControls", () => {
  it("keeps server-bound files separate from unbound candidates and exposes controlled actions", () => {
    const onRefresh = vi.fn();
    const onRemove = vi.fn();
    const onUpload = vi.fn();

    render(
      <Form layout="vertical">
        <EditFileFieldControls
          definitions={definitions}
          disabled={false}
          filesByField={{
            qualification: [
              { displayName: "已绑定.pdf", fileId: 11, status: "BOUND" },
              { displayName: "待检查.pdf", fileId: 12, status: "ACCEPTED_FOR_INSPECTION" },
            ],
          }}
          uploading={false}
          onRefresh={onRefresh}
          onRemove={onRemove}
          onUpload={onUpload}
        />
      </Form>,
    );

    expect(screen.getByText("已绑定")).toBeInTheDocument();
    expect(screen.getByText("正在安全检查")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "刷新资质文件文件已绑定.pdf状态" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "刷新资质文件文件待检查.pdf状态" }));
    fireEvent.click(screen.getByRole("button", { name: "移除资质文件文件已绑定.pdf" }));
    fireEvent.change(screen.getByLabelText("资质文件"), {
      target: { files: [new File(["contents"], "新增.pdf", { type: "application/pdf" })] },
    });

    expect(onRefresh).toHaveBeenCalledWith("qualification", 12);
    expect(onRemove).toHaveBeenCalledWith("qualification", 11);
    expect(onUpload).toHaveBeenCalledWith("qualification", [expect.any(File)]);
  });

  it("associates file-field validation feedback with its picker", () => {
    render(
      <Form layout="vertical">
        <EditFileFieldControls
          definitions={definitions}
          disabled={false}
          errors={{ qualification: "每个自定义文件字段最多保留 10 个文件。" }}
          filesByField={{ qualification: [] }}
          uploading={false}
          onRefresh={vi.fn()}
          onRemove={vi.fn()}
          onUpload={vi.fn()}
        />
      </Form>,
    );

    const picker = screen.getByLabelText("资质文件");
    const feedback = screen.getByRole("alert");
    expect(picker).toHaveAttribute("aria-invalid", "true");
    expect(picker).toHaveAttribute("aria-describedby", feedback.id);
    expect(feedback).toHaveTextContent("每个自定义文件字段最多保留 10 个文件。");
  });
});
