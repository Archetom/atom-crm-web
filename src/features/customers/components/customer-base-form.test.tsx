import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerBaseForm } from "./customer-base-form";

const requiredCustomTextField = {
  code: "cf_source",
  displayName: "客户来源",
  fieldType: "TEXT" as const,
  builtin: false,
  required: true,
  searchable: true,
  status: "ACTIVE" as const,
  displayOrder: 1,
  sectionName: "基本信息",
  options: [],
};

afterEach(cleanup);

describe("CustomerBaseForm", () => {
  it("submits validated form state rather than Ant Design form values", async () => {
    const onSubmit = vi.fn();
    render(
      <CustomerBaseForm
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        submitText="创建客户"
        submitting={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("请输入客户名称"), {
      target: { value: "Acme" },
    });
    fireEvent.change(screen.getByPlaceholderText("例如 +8613812345678"), {
      target: { value: "+8613812345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建客户" }));

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
        name: "Acme",
        phoneNumber: "+8613812345678",
      });
    });
  });

  it("shows the reviewed phone validation instead of submitting", async () => {
    const onSubmit = vi.fn();
    render(
      <CustomerBaseForm
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        submitText="创建客户"
        submitting={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("请输入客户名称"), {
      target: { value: "Acme" },
    });
    fireEvent.change(screen.getByPlaceholderText("例如 +8613812345678"), {
      target: { value: "13812345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建客户" }));

    expect(
      await screen.findByText("手机号需使用 + 国家码格式，例如 +8613812345678"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("can submit the same validated values for an explicit duplicate check", async () => {
    const onCheckDuplicate = vi.fn();
    render(
      <CustomerBaseForm
        onCancel={vi.fn()}
        onCheckDuplicate={onCheckDuplicate}
        onSubmit={vi.fn()}
        submitText="创建客户"
        submitting={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("请输入客户名称"), {
      target: { value: "Acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: "检查重复" }));

    await waitFor(() => {
      expect(onCheckDuplicate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Acme", phoneNumber: "" }),
      );
    });
  });

  it("submits the same validated values for the optional follow-up action", async () => {
    const onSecondarySubmit = vi.fn();
    render(
      <CustomerBaseForm
        onCancel={vi.fn()}
        onSecondarySubmit={onSecondarySubmit}
        onSubmit={vi.fn()}
        secondarySubmitText="创建并新建联系人"
        submitText="创建客户"
        submitting={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("请输入客户名称"), {
      target: { value: "Acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建并新建联系人" }));

    await waitFor(() => {
      expect(onSecondarySubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Acme", phoneNumber: "" }),
      );
    });
  });

  it("requires server-catalog custom fields and sends only the edited field value", async () => {
    const onSubmit = vi.fn();
    render(
      <CustomerBaseForm
        customFieldDefinitions={[requiredCustomTextField]}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        submitText="创建客户"
        submitting={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("请输入客户名称"), {
      target: { value: "Acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建客户" }));

    expect(await screen.findByText("客户来源为必填项")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("客户来源"), {
      target: { value: "自主开发" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建客户" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ customFields: { cf_source: ["自主开发"] } }),
      );
    });
  });
});
