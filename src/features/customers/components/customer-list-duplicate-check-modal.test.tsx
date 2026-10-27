import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerListDuplicateCheckModal } from "./customer-list-duplicate-check-modal";

afterEach(cleanup);

describe("CustomerListDuplicateCheckModal", () => {
  it("requires a visible customer identity before it starts the real duplicate check", async () => {
    const onCheck = vi.fn();
    render(
      <CustomerListDuplicateCheckModal open pending={false} onCancel={vi.fn()} onCheck={onCheck} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /查\s*重/ }));

    expect(await screen.findByText("请填写客户名称或联系电话")).toBeInTheDocument();
    expect(onCheck).not.toHaveBeenCalled();
  });

  it("passes only validated inputs to the page mutation and makes the boolean result explicit", async () => {
    const onCheck = vi.fn();
    render(
      <CustomerListDuplicateCheckModal
        open
        pending={false}
        result={true}
        onCancel={vi.fn()}
        onCheck={onCheck}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "客户名称" }), {
      target: { value: "Acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: /查\s*重/ }));

    await waitFor(() => {
      expect(onCheck.mock.calls[0]?.[0]).toEqual({ name: "Acme", phoneNumber: "" });
    });
    expect(screen.getByText("发现当前可见范围内存在重复客户。")).toBeInTheDocument();
  });
});
