import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { DashboardTargetPanel } from "./dashboard-target-panel";

afterEach(cleanup);

describe("DashboardTargetPanel", () => {
  it("uses the target, amount, and completion rate returned in one overview snapshot", () => {
    render(
      <DashboardTargetPanel
        from="2026-08-01"
        target={{
          actualAmount: 30.3,
          completionRate: 30.3,
          metric: "ACTIVE_CONTRACT",
          status: "AVAILABLE",
          targetAmount: 100,
        }}
        to="2026-08-31"
      />,
    );

    expect(screen.getByText("目标金额")).toBeInTheDocument();
    expect(screen.getByText("完成金额")).toBeInTheDocument();
    expect(screen.getAllByText("30.30%").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("合同金额目标完成率")).toBeInTheDocument();
  });

  it("offers the authorized target-management route without replacing the overview snapshot", () => {
    render(
      <MemoryRouter>
        <DashboardTargetPanel
          from="2026-08-01"
          target={{ metric: "ACTIVE_CONTRACT", status: "EMPTY" }}
          targetManagementPath="/administration/performance-targets"
          to="2026-08-31"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "设置目标" })).toHaveAttribute(
      "href",
      "/administration/performance-targets",
    );
    expect(screen.getByText("当前时间范围内未配置合同金额目标")).toBeInTheDocument();
  });

  it("keeps missing and withheld targets distinct", () => {
    const { rerender } = render(
      <DashboardTargetPanel
        from="2026-08-01"
        target={{
          metric: "ACTIVE_CONTRACT",
          status: "EMPTY",
        }}
        to="2026-08-31"
      />,
    );

    expect(screen.getByText("当前时间范围内未配置合同金额目标")).toBeInTheDocument();
    rerender(
      <DashboardTargetPanel
        from="2026-08-01"
        target={{ metric: "ACTIVE_CONTRACT", status: "UNAVAILABLE" }}
        to="2026-08-31"
      />,
    );
    expect(screen.getByText("当前数据范围或权限下暂不可展示目标完成情况")).toBeInTheDocument();
  });
});
