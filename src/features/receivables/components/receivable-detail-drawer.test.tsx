import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../pages/customer-receivable-detail-page", () => ({
  CustomerReceivableDetailSurface: ({
    receivableId,
    onClose,
  }: {
    receivableId: number | null;
    onClose?: () => void;
  }) => (
    <button type="button" onClick={onClose}>
      {`回款 ${receivableId ?? "none"}`}
    </button>
  ),
}));

import { ReceivableDetailDrawer } from "./receivable-detail-drawer";

afterEach(cleanup);

describe("ReceivableDetailDrawer", () => {
  it("uses the shared detail surface and lets the list context close it", async () => {
    const onClose = vi.fn();
    render(<ReceivableDetailDrawer receivableId={42} open onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "回款详情" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "回款 42" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
