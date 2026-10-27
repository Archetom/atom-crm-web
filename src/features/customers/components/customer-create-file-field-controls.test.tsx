import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerCreateFileFieldControls } from "./customer-create-file-field-controls";

const fileField = {
  code: "cf_qualification",
  displayName: "资质附件",
  fieldType: "FILE" as const,
  builtin: false,
  required: true,
  searchable: false,
  status: "ACTIVE" as const,
  displayOrder: 1,
  sectionName: "基本信息",
  options: [],
};

afterEach(cleanup);

describe("CustomerCreateFileFieldControls", () => {
  it("passes selected bytes to the governed upload callback rather than accepting file IDs", () => {
    const onUpload = vi.fn();
    render(
      <CustomerCreateFileFieldControls
        definitions={[fileField]}
        disabled={false}
        filesByField={{}}
        uploading={false}
        onRemove={vi.fn()}
        onUpload={onUpload}
      />,
    );

    const file = new File(["proof"], "资质证明.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("资质附件"), { target: { files: [file] } });

    expect(onUpload).toHaveBeenCalledWith("cf_qualification", [file]);
  });

  it("renders only server-confirmed upload IDs and supports removing one pending binding", () => {
    const onRemove = vi.fn();
    render(
      <CustomerCreateFileFieldControls
        definitions={[fileField]}
        disabled={false}
        filesByField={{
          cf_qualification: [
            {
              displayName: "资质证明.pdf",
              fileId: 41,
              mediaType: "application/pdf",
              size: 5,
              status: "UPLOADED",
            },
          ],
        }}
        uploading={false}
        onRemove={onRemove}
        onUpload={vi.fn()}
      />,
    );

    expect(screen.getByText("已上传")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "移除资质附件文件资质证明.pdf" }));
    expect(onRemove).toHaveBeenCalledWith("cf_qualification", 41);
  });
});
