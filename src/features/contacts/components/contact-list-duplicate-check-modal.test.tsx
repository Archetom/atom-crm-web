import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContactListDuplicateCheckModal } from "./contact-list-duplicate-check-modal";

afterEach(cleanup);

describe("ContactListDuplicateCheckModal", () => {
  it("requires a visible contact identity before it starts the real duplicate check", async () => {
    const onCheck = vi.fn();
    render(
      <ContactListDuplicateCheckModal open pending={false} onCancel={vi.fn()} onCheck={onCheck} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /查\s*重/ }));

    expect(await screen.findByText("请填写联系人姓名或联系电话")).toBeInTheDocument();
    expect(onCheck).not.toHaveBeenCalled();
  });

  it("passes only validated inputs to the page mutation and makes the boolean result explicit", async () => {
    const onCheck = vi.fn();
    render(
      <ContactListDuplicateCheckModal
        open
        pending={false}
        result={true}
        onCancel={vi.fn()}
        onCheck={onCheck}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "联系人姓名" }), {
      target: { value: "张三" },
    });
    fireEvent.click(screen.getByRole("button", { name: /查\s*重/ }));

    await waitFor(() => {
      expect(onCheck.mock.calls[0]?.[0]).toEqual({ name: "张三", phoneNumber: "" });
    });
    expect(screen.getByText("发现当前可见范围内存在重复联系人。")).toBeInTheDocument();
  });
});
