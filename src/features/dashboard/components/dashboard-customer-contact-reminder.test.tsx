import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { components } from "~/api/generated/schema";

import { DashboardCustomerContactReminder } from "./dashboard-customer-contact-reminder";

afterEach(cleanup);

const reminder = {
  buckets: [
    { bucket: "OVER_7_DAYS", count: 12 },
    { bucket: "OVER_15_DAYS", count: 8 },
    { bucket: "OVER_30_DAYS", count: 5 },
    { bucket: "OVER_3_MONTHS", count: 3 },
    { bucket: "OVER_6_MONTHS", count: 1 },
    { bucket: "OVERDUE", count: 2 },
  ],
  status: "AVAILABLE",
} satisfies components["schemas"]["CustomerContactReminderResponse"];

describe("DashboardCustomerContactReminder", () => {
  it("presents every server-returned threshold in the selected dashboard scope", () => {
    render(
      <DashboardCustomerContactReminder
        preferredDataScope="DEPARTMENT_SUBTREE"
        reminder={reminder}
      />,
    );

    expect(screen.getByRole("heading", { name: "客户遗忘提醒" })).toBeInTheDocument();
    expect(
      screen.getByText("本人及下属 · 按客户最近一次有效跟进和下次联系计划汇总"),
    ).toBeInTheDocument();
    expect(screen.getByText("超过7天未联系")).toBeInTheDocument();
    expect(screen.getByText("超过6个月未联系警告")).toBeInTheDocument();
    expect(screen.getByText("逾期未联系已逾期")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("keeps unavailable and failed states distinct without inventing customer data", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <DashboardCustomerContactReminder reminder={{ buckets: [], status: "UNAVAILABLE" }} />,
    );

    expect(screen.getByText("当前数据范围或权限下暂不可展示客户联系提醒")).toBeInTheDocument();
    rerender(<DashboardCustomerContactReminder isError onRetry={onRetry} reminder={undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByText("超过7天未联系")).not.toBeInTheDocument();
  });

  it("exposes a named close action and keeps a failed close visible for retry", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <DashboardCustomerContactReminder onClose={onClose} reminder={reminder} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<DashboardCustomerContactReminder closeError onClose={onClose} reminder={reminder} />);
    expect(screen.getByText("关闭客户遗忘提醒失败")).toBeInTheDocument();
  });
});
