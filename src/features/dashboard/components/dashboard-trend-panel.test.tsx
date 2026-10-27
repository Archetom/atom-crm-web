import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardTrendPanel } from "./dashboard-trend-panel";

afterEach(cleanup);

describe("DashboardTrendPanel", () => {
  it("switches only among the server-returned overview metrics", () => {
    const onSelectMetric = vi.fn();
    render(
      <DashboardTrendPanel
        card={{ amount: 2, count: 1, metric: "WON_OPPORTUNITY", points: [], status: "AVAILABLE" }}
        cards={[
          { amount: 2, count: 1, metric: "WON_OPPORTUNITY", points: [], status: "AVAILABLE" },
          { amount: 3, count: 2, metric: "ACTIVE_CONTRACT", points: [], status: "AVAILABLE" },
        ]}
        from="2026-08-01"
        granularity="DAY"
        onSelectMetric={onSelectMetric}
        to="2026-08-08"
      />,
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "趋势指标" }));
    fireEvent.click(screen.getByText("有效合同"));

    expect(onSelectMetric).toHaveBeenCalledWith("ACTIVE_CONTRACT");
  });

  it("renders only the selected metric's server-returned trend points as an accessible line chart", () => {
    render(
      <DashboardTrendPanel
        card={{
          amount: 12,
          count: 2,
          metric: "WON_OPPORTUNITY",
          points: [{ amount: 8, count: 1, periodStart: "2026-08-01" }],
          status: "AVAILABLE",
        }}
        from="2026-08-01"
        granularity="DAY"
        to="2026-08-08"
      />,
    );

    expect(screen.getByRole("heading", { name: "赢单商机趋势" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "赢单商机金额折线图" })).toBeInTheDocument();
    expect(screen.getByText("2026-08-01：8 元，数量 1")).toBeInTheDocument();
  });

  it("switches between line and bar presentation without changing the server-returned series", () => {
    render(
      <DashboardTrendPanel
        card={{
          amount: 12,
          count: 2,
          metric: "WON_OPPORTUNITY",
          points: [
            { amount: 8, count: 1, periodStart: "2026-08-01" },
            { amount: 12, count: 2, periodStart: "2026-08-02" },
          ],
          status: "AVAILABLE",
        }}
        from="2026-08-01"
        granularity="DAY"
        to="2026-08-08"
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "柱状图" }));

    expect(screen.getByRole("img", { name: "赢单商机金额柱状图" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("当前以柱状图显示赢单商机金额趋势");
    expect(screen.getByText("2026-08-02：12 元，数量 2")).toBeInTheDocument();
  });

  it("thins long-series axis labels without dropping the accessible server-returned points", () => {
    const points = Array.from({ length: 9 }, (_, index) => ({
      amount: index,
      count: index,
      periodStart: `2026-08-${String(index + 1).padStart(2, "0")}`,
    }));

    render(
      <DashboardTrendPanel
        card={{
          amount: 36,
          count: 36,
          metric: "WON_OPPORTUNITY",
          points,
          status: "AVAILABLE",
        }}
        from="2026-08-01"
        granularity="DAY"
        to="2026-08-09"
      />,
    );

    expect(screen.getByText("08-01")).toBeInTheDocument();
    expect(screen.queryByText("08-02")).not.toBeInTheDocument();
    expect(screen.getByText("08-09")).toBeInTheDocument();
    expect(screen.getByText("2026-08-02：1 元，数量 1")).toBeInTheDocument();
  });

  it("does not show a fabricated trend when the server marks the metric unavailable", () => {
    render(
      <DashboardTrendPanel
        card={{ metric: "ACTIVE_RECEIVABLE", points: [], status: "UNAVAILABLE" }}
        from="2026-08-01"
        granularity="DAY"
        to="2026-08-08"
      />,
    );

    expect(screen.getByText("当前权限范围内暂不可展示该指标趋势")).toBeInTheDocument();
  });
});
