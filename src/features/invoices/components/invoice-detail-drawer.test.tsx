import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../pages/customer-invoice-detail-page", () => ({
  CustomerInvoiceDetailSurface: ({
    invoiceId,
    onClose,
  }: {
    invoiceId: number | null;
    onClose?: () => void;
  }) => (
    <button type="button" onClick={onClose}>
      {`发票 ${invoiceId ?? "none"}`}
    </button>
  ),
}));

import { InvoiceDetailDrawer } from "./invoice-detail-drawer";

afterEach(cleanup);

describe("InvoiceDetailDrawer", () => {
  it("uses the shared detail surface and lets the list context close it", async () => {
    const onClose = vi.fn();
    render(<InvoiceDetailDrawer invoiceId={42} open onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "发票详情" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "发票 42" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
