import { Alert, Button, Card, Skeleton, Statistic, Tag, Typography } from "antd";

import type { components } from "~/api/generated/schema";

import { formatServerAmount } from "../model/format";

import styles from "./dashboard-data-summary.module.css";

type DashboardDataSummary = components["schemas"]["DataSummaryResponse"];

const sections = [
  {
    metrics: [
      "NEW_CUSTOMER",
      "CONVERTED_CUSTOMER",
      "CUSTOMER_RELEASED_TO_POOL",
      "CUSTOMER_CLAIMED_FROM_POOL",
    ],
    title: "客户",
  },
  {
    metrics: ["NEW_OPPORTUNITY", "WON_OPPORTUNITY", "LOST_OPPORTUNITY", "OPPORTUNITY_AMOUNT"],
    title: "商机",
  },
  {
    metrics: ["SIGNED_CONTRACT", "EXPIRING_CONTRACT", "EXPIRED_CONTRACT", "CONTRACT_AMOUNT"],
    title: "合同",
  },
  { metrics: ["FOLLOWED_CUSTOMER", "NEW_UNFOLLOWED_CUSTOMER"], title: "跟进" },
  { metrics: ["RECEIVABLE_AMOUNT", "EXPECTED_RECEIVABLE"], title: "回款" },
] as const;

const labels: Record<string, string> = {
  CONTRACT_AMOUNT: "合同金额",
  CONVERTED_CUSTOMER: "转成交客户",
  CUSTOMER_CLAIMED_FROM_POOL: "公海池领取",
  CUSTOMER_RELEASED_TO_POOL: "放入公海客户",
  EXPECTED_RECEIVABLE: "预计回款",
  EXPIRED_CONTRACT: "已到期",
  EXPIRING_CONTRACT: "即将到期",
  FOLLOWED_CUSTOMER: "跟进客户数",
  LOST_OPPORTUNITY: "输单商机",
  NEW_CUSTOMER: "新增客户",
  NEW_OPPORTUNITY: "新增商机",
  NEW_UNFOLLOWED_CUSTOMER: "新增未跟进客户数",
  OPPORTUNITY_AMOUNT: "商机总金额",
  RECEIVABLE_AMOUNT: "回款金额",
  SIGNED_CONTRACT: "签约合同",
  WON_OPPORTUNITY: "赢单商机",
};

function formatValue(item: DashboardDataSummary | undefined): string {
  if (item?.status !== "AVAILABLE" || typeof item.value !== "number") return "—";

  return item.unit === "AMOUNT"
    ? formatServerAmount(item.value)
    : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(item.value);
}

function suffix(item: DashboardDataSummary | undefined): string {
  if (item?.unit === "AMOUNT") return "元";
  return "个";
}

/** Renders only the server-returned, independently permission-checked data-summary facts. */
export function DashboardDataSummary({
  isError,
  isLoading,
  onRetry,
  summary,
}: Readonly<{
  isError: boolean;
  isLoading: boolean;
  onRetry(): void;
  summary: readonly DashboardDataSummary[];
}>) {
  const byMetric = new Map(summary.map((item) => [item.metric, item]));

  return (
    <Card
      className={styles.panel}
      title={
        <Typography.Title level={2} style={{ fontSize: "inherit", margin: 0 }}>
          数据汇总
        </Typography.Title>
      }
    >
      {isError ? (
        <Alert
          action={
            <Button size="small" type="primary" onClick={onRetry}>
              重新加载
            </Button>
          }
          title="数据汇总暂时无法加载"
          showIcon
          type="error"
        />
      ) : null}
      {isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : null}
      {!isLoading && !isError ? (
        <div className={styles.sections}>
          {sections.map((section) => (
            <section
              aria-label={`${section.title}数据汇总`}
              className={styles.section}
              key={section.title}
            >
              <Typography.Text className={styles.sectionTitle} strong>
                {section.title}
              </Typography.Text>
              <div className={styles.metrics}>
                {section.metrics.map((metric) => {
                  const item = byMetric.get(metric);
                  const unavailable = item?.status !== "AVAILABLE";

                  return (
                    <article className={styles.metric} key={metric}>
                      <div className={styles.metricHeading}>
                        <Typography.Text>{labels[metric]}</Typography.Text>
                        {unavailable ? <Tag>暂不可用</Tag> : null}
                      </div>
                      <Statistic suffix={suffix(item)} value={formatValue(item)} />
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
