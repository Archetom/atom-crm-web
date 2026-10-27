import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DashboardRankingPanel } from "./dashboard-ranking-panel";

afterEach(cleanup);

describe("DashboardRankingPanel", () => {
  it("renders the default ranking returned in the dashboard snapshot", () => {
    render(
      <DashboardRankingPanel
        from="2026-08-01"
        rankings={[
          {
            items: [{ amount: 8, count: 1, ownerActorId: 7, rank: 1 }],
            metric: "WON_OPPORTUNITY",
            status: "AVAILABLE",
          },
          {
            items: [{ amount: 12, count: 2, ownerActorId: 9, rank: 1 }],
            metric: "ACTIVE_RECEIVABLE",
            status: "AVAILABLE",
          },
        ]}
        to="2026-08-08"
      />,
    );

    expect(screen.getByText("成员 #7")).toBeInTheDocument();
    expect(screen.getByText("赢单商机")).toBeInTheDocument();
    expect(screen.getByLabelText("排行榜指标")).toBeInTheDocument();
    expect(screen.queryByText("成员 #9")).not.toBeInTheDocument();
  });

  it("does not fabricate rows when the server withholds a metric", () => {
    render(
      <DashboardRankingPanel
        from="2026-08-01"
        rankings={[{ items: [], metric: "ACTIVE_CONTRACT", status: "UNAVAILABLE" }]}
        to="2026-08-08"
      />,
    );

    expect(screen.getByText("当前权限范围内暂不可展示该指标排行")).toBeInTheDocument();
  });
});
