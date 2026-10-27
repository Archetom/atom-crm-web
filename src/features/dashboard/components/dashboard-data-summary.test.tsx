import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardDataSummary } from "./dashboard-data-summary";

describe("DashboardDataSummary", () => {
  it("keeps unavailable metrics opaque instead of displaying zero", () => {
    render(
      <DashboardDataSummary
        isError={false}
        isLoading={false}
        summary={[
          { metric: "NEW_CUSTOMER", status: "AVAILABLE", unit: "COUNT", value: 3 },
          { metric: "CONVERTED_CUSTOMER", status: "UNAVAILABLE", unit: "COUNT" },
          { metric: "CONTRACT_AMOUNT", status: "AVAILABLE", unit: "AMOUNT", value: 1024.5 },
        ]}
        onRetry={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "数据汇总" })).toBeInTheDocument();
    expect(screen.getByText("新增客户").parentElement?.parentElement).toHaveTextContent("3个");
    expect(screen.getByText("转成交客户").parentElement?.parentElement).toHaveTextContent(
      "暂不可用—",
    );
    expect(screen.getByText("合同金额").parentElement?.parentElement).toHaveTextContent(
      "1,024.5元",
    );
    expect(screen.getAllByText("暂不可用")).toHaveLength(14);
  });
});
