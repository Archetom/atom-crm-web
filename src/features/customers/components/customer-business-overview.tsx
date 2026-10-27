import { Alert, Badge, Card, Statistic, Typography } from "antd";

import type {
  CustomerBusinessOverview,
  CustomerBusinessOverviewSource,
} from "../model/customer-business-overview";

import styles from "./customer-business-overview.module.css";

const sourceLabels: Record<CustomerBusinessOverviewSource, string> = {
  CONTACT: "联系人",
  OPEN_OPPORTUNITY: "进行中商机",
  ACTIVE_CONTRACT: "有效合同",
  PENDING_INVOICE: "待处理发票",
  ACTIVE_RECEIVABLE: "待回款",
  ACTIVE_RECEIVABLE_PLAN: "回款计划",
  RETURN_VISIT: "回访",
};

function formatAmount(amount: number | string | null): string {
  if (amount === null) return "—";
  if (typeof amount === "string") return amount;
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function CustomerBusinessOverviewCards({
  overview,
}: Readonly<{
  overview: CustomerBusinessOverview;
}>) {
  return (
    <div className={styles.grid}>
      {overview.cards.map((card) => {
        const unavailable = card.status === "UNAVAILABLE";
        return (
          <Card className={styles.card} key={card.source} size="small">
            <div className={styles.header}>
              <Typography.Text strong>{sourceLabels[card.source]}</Typography.Text>
              <Badge
                status={unavailable ? "default" : "success"}
                text={unavailable ? "暂不可用" : "已更新"}
              />
            </div>
            <Statistic value={unavailable ? "—" : formatAmount(card.amount)} />
            <Typography.Text type="secondary">
              {unavailable || card.count === null ? "无可见数量" : `数量 ${card.count}`}
            </Typography.Text>
          </Card>
        );
      })}
    </div>
  );
}

export function CustomerBusinessOverviewUnavailable() {
  return <Alert title="客户业务概览暂时无法加载" showIcon type="error" />;
}
