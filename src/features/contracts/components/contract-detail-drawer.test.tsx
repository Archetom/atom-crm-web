import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../pages/customer-contract-detail-page", () => ({
  CustomerContractDetailSurface: ({
    contractId,
    customerId,
    onClose,
  }: {
    contractId: number | null;
    customerId: number | null;
    onClose?: () => void;
  }) => (
    <button type="button" onClick={onClose}>
      {`合同 ${contractId ?? "none"} / 客户 ${customerId ?? "none"}`}
    </button>
  ),
}));

import { ContractDetailDrawer } from "./contract-detail-drawer";

afterEach(cleanup);

describe("ContractDetailDrawer", () => {
  it("uses the shared detail surface and lets the list context close it", async () => {
    const onClose = vi.fn();
    render(<ContractDetailDrawer contractId={42} customerId={null} open onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "合同详情" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "合同 42 / 客户 none" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
