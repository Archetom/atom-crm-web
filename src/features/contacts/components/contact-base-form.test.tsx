import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContactBaseForm } from "./contact-base-form";

afterEach(cleanup);

describe("ContactBaseForm", () => {
  it("submits validated form state rather than Ant Design form values", async () => {
    const onSubmit = vi.fn();
    render(
      <ContactBaseForm
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        submitText="创建联系人"
        submitting={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("请输入联系人姓名"), {
      target: { value: "张三" },
    });
    fireEvent.change(screen.getByPlaceholderText("请输入职务"), {
      target: { value: "采购经理" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建联系人" }));

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
        name: "张三",
        jobTitle: "采购经理",
      });
    });
  });

  it("shows the reviewed phone validation instead of submitting", async () => {
    const onSubmit = vi.fn();
    render(
      <ContactBaseForm
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        submitText="创建联系人"
        submitting={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("请输入联系人姓名"), {
      target: { value: "张三" },
    });
    fireEvent.change(screen.getByPlaceholderText("例如 +8613812345678"), {
      target: { value: "13812345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建联系人" }));

    expect(
      await screen.findByText("手机号需使用 + 国家码格式，例如 +8613812345678"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("can submit the same validated values for an explicit duplicate check", async () => {
    const onCheckDuplicate = vi.fn();
    render(
      <ContactBaseForm
        onCancel={vi.fn()}
        onCheckDuplicate={onCheckDuplicate}
        onSubmit={vi.fn()}
        submitText="创建联系人"
        submitting={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("请输入联系人姓名"), {
      target: { value: "张三" },
    });
    fireEvent.click(screen.getByRole("button", { name: "检查重复" }));

    await waitFor(() => {
      expect(onCheckDuplicate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "张三", phoneNumber: "" }),
      );
    });
  });
});
