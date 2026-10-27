import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardSalesFunnel } from "./dashboard-sales-funnel";

afterEach(cleanup);

const funnel = {
  pipelines: [
    {
      code: "direct",
      name: "直营流程",
      stages: [
        { amount: 30.3, code: "qualification", count: 2, name: "需求确认", probability: 20 },
        { amount: 0, code: "proposal", count: 0, name: "方案报价", probability: 60 },
      ],
    },
    {
      code: "partner",
      name: "合作流程",
      stages: [{ amount: 8, code: "review", count: 1, name: "商务评审", probability: 50 }],
    },
  ],
  status: "AVAILABLE" as const,
};

describe("DashboardSalesFunnel", () => {
  it("switches only among server-returned pipelines and local amount/count presentation modes", () => {
    render(<DashboardSalesFunnel from="2026-08-01" funnel={funnel} to="2026-08-31" />);

    expect(screen.getByText("直营流程")).toBeInTheDocument();
    expect(screen.getByText("需求确认")).toBeInTheDocument();
    expect(screen.getByText("金额 30.3 元")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "数量" }));
    expect(screen.getByRole("status")).toHaveTextContent("当前查看直营流程的数量漏斗");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "销售流程" }));
    fireEvent.click(screen.getByText("合作流程"));

    expect(screen.getByText("商务评审")).toBeInTheDocument();
    expect(screen.queryByText("需求确认")).not.toBeInTheDocument();
  });

  it("keeps unavailable, empty, and failed states distinct without inventing stage data", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <DashboardSalesFunnel funnel={{ pipelines: [], status: "UNAVAILABLE" }} />,
    );

    expect(screen.getByText("当前数据范围或权限下暂不可展示销售漏斗")).toBeInTheDocument();
    rerender(<DashboardSalesFunnel funnel={{ pipelines: [], status: "EMPTY" }} />);
    expect(screen.getByText("当前范围内没有可展示的销售流程")).toBeInTheDocument();
    rerender(<DashboardSalesFunnel funnel={undefined} isError onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByText("需求确认")).not.toBeInTheDocument();
  });
});
