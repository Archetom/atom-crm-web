import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardSalesBrief } from "./dashboard-sales-brief";

afterEach(cleanup);

describe("DashboardSalesBrief", () => {
  it("renders server-returned values and comparison rates without filling withheld metrics", () => {
    render(
      <DashboardSalesBrief
        brief={[
          {
            comparisonRate: 25,
            metric: "NEW_CUSTOMER",
            previousValue: 4,
            status: "AVAILABLE",
            unit: "COUNT",
            value: 5,
          },
          {
            comparisonRate: 100,
            metric: "NEW_FOLLOW_UP",
            previousValue: 2,
            status: "AVAILABLE",
            unit: "COUNT",
            value: 4,
          },
          {
            comparisonRate: 0,
            metric: "NEW_OPPORTUNITY",
            previousValue: 3,
            status: "AVAILABLE",
            unit: "COUNT",
            value: 3,
          },
          {
            metric: "CONTRACT_AMOUNT",
            status: "UNAVAILABLE",
            unit: "AMOUNT",
          },
        ]}
        isError={false}
        isLoading={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("article", { name: "新增客户销售简报" })).toHaveTextContent(
      "较上一周期 +25.00%",
    );
    expect(screen.getByRole("article", { name: "新增合同金额销售简报" })).toHaveTextContent("—");
    expect(screen.getByRole("article", { name: "新增跟进销售简报" })).toHaveTextContent(
      "较上一周期 +100.00%",
    );
    expect(screen.getByRole("article", { name: "新增客户销售简报" })).toHaveTextContent("5人");
    expect(screen.getByRole("article", { name: "新增跟进销售简报" })).toHaveTextContent("4条");
    expect(screen.getByRole("article", { name: "新增商机销售简报" })).toHaveTextContent("3个");
    expect(screen.getByText("当前权限范围内暂不可展示")).toBeInTheDocument();
  });

  it("keeps a request failure separate from a successful empty brief", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <DashboardSalesBrief brief={[]} isError isLoading={false} onRetry={onRetry} />,
    );

    expect(screen.getByText("销售简报暂时无法加载")).toBeInTheDocument();
    screen.getByRole("button", { name: "重新加载" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <DashboardSalesBrief brief={[]} isError={false} isLoading={false} onRetry={onRetry} />,
    );
    expect(screen.getByText("当前时间范围内暂无可展示的销售简报")).toBeInTheDocument();
  });
});
