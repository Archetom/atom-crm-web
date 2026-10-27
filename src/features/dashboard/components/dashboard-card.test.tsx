import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardCard } from "./dashboard-card";

afterEach(cleanup);

describe("DashboardCard", () => {
  it("uses a named native control to select a server-returned metric", () => {
    const onSelect = vi.fn();
    render(
      <DashboardCard
        active={false}
        amount={12}
        count={2}
        metric="WON_OPPORTUNITY"
        points={[]}
        status="AVAILABLE"
        onSelect={onSelect}
      />,
    );

    const control = screen.getByRole("button", { name: "查看赢单商机趋势" });
    expect(control).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(control);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
