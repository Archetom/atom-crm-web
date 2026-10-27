import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../pages/customer-return-visit-detail-page", () => ({
  CustomerReturnVisitDetailSurface: ({
    returnVisitId,
    onClose,
    onEdit,
  }: {
    returnVisitId: number | null;
    onClose?: () => void;
    onEdit?: (customerId: number, returnVisitId: number) => void;
  }) => (
    <>
      <button type="button" onClick={onClose}>
        {`关闭回访 ${returnVisitId ?? "none"}`}
      </button>
      <button type="button" onClick={() => onEdit?.(7, returnVisitId ?? 0)}>
        编辑
      </button>
    </>
  ),
}));

import { ReturnVisitDetailDrawer } from "./return-visit-detail-drawer";

afterEach(cleanup);

describe("ReturnVisitDetailDrawer", () => {
  it("uses the shared detail surface and delegates closing and editing to the list context", async () => {
    const onClose = vi.fn();
    const onEdit = vi.fn();
    render(<ReturnVisitDetailDrawer returnVisitId={42} open onClose={onClose} onEdit={onEdit} />);

    expect(screen.getByRole("dialog", { name: "回访详情" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭回访 42" }));
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onEdit).toHaveBeenCalledWith(7, 42);
  });
});
