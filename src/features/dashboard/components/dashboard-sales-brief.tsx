import { Alert, Button, Card, Empty, Skeleton, Statistic, Typography } from "antd";

import type { components } from "~/api/generated/schema";

import { formatSalesBriefMetric, formatServerAmount } from "../model/format";

import styles from "./dashboard-sales-brief.module.css";

type SalesBrief = components["schemas"]["SalesBriefResponse"];

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
}

function countSuffix(metric: SalesBrief["metric"]): string {
  if (metric === "NEW_CUSTOMER" || metric === "NEW_CONTACT") return "人";
  if (metric === "NEW_FOLLOW_UP") return "条";
  return "个";
}

function comparisonText(brief: SalesBrief): string {
  if (brief.status === "UNAVAILABLE") return "当前权限范围内暂不可展示";
  if (typeof brief.comparisonRate !== "number") return "暂无可比周期";
  if (brief.comparisonRate === 0) return "与上一周期持平";

  return `较上一周期 ${brief.comparisonRate > 0 ? "+" : ""}${brief.comparisonRate.toFixed(2)}%`;
}

function valueText(brief: SalesBrief): string {
  if (brief.status === "UNAVAILABLE" || typeof brief.value !== "number") return "—";

  return brief.unit === "AMOUNT" ? formatServerAmount(brief.value) : formatCount(brief.value);
}

function valueSuffix(brief: SalesBrief): string {
  return brief.unit === "AMOUNT" ? "元" : countSuffix(brief.metric);
}

function comparisonClassName(brief: SalesBrief): string {
  if (brief.status === "UNAVAILABLE" || typeof brief.comparisonRate !== "number") {
    return styles.comparisonMuted;
  }

  if (brief.comparisonRate > 0) return styles.comparisonPositive;
  if (brief.comparisonRate < 0) return styles.comparisonNegative;
  return styles.comparisonMuted;
}

/** Renders only the fixed sales-brief facts and comparison rates returned by the current overview. */
export function DashboardSalesBrief({
  brief,
  isError,
  isLoading,
  onRetry,
}: Readonly<{
  brief: readonly SalesBrief[];
  isError: boolean;
  isLoading: boolean;
  onRetry(): void;
}>) {
  return (
    <section aria-labelledby="sales-brief-heading" className={styles.salesBrief}>
      <header className={styles.header}>
        <Typography.Title id="sales-brief-heading" level={2}>
          销售简报
        </Typography.Title>
      </header>
      {isError ? (
        <Alert
          action={
            <Button size="small" type="primary" onClick={onRetry}>
              重新加载
            </Button>
          }
          className={styles.feedback}
          title="销售简报暂时无法加载"
          showIcon
          type="error"
        />
      ) : null}
      {isLoading ? <Skeleton active className={styles.feedback} paragraph={{ rows: 4 }} /> : null}
      {!isError && !isLoading && brief.length === 0 ? (
        <Empty
          className={styles.feedback}
          description="当前时间范围内暂无可展示的销售简报"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : null}
      {!isError && !isLoading && brief.length > 0 ? (
        <div className={styles.grid}>
          {brief.map((item) => {
            const unavailable = item.status === "UNAVAILABLE";
            const label = formatSalesBriefMetric(item.metric);
            const primary = item.metric === "NEW_CUSTOMER" && !unavailable;

            return (
              <article
                aria-label={`${label}销售简报`}
                className={`${styles.metric} ${primary ? styles.primaryMetric : ""}`}
                key={item.metric}
              >
                <Card size="small">
                  <div className={styles.metricHeader}>
                    <Typography.Text strong>{label}</Typography.Text>
                    {unavailable ? (
                      <Typography.Text className={styles.unavailable} type="secondary">
                        暂不可用
                      </Typography.Text>
                    ) : null}
                  </div>
                  <Statistic suffix={valueSuffix(item)} value={valueText(item)} />
                  <Typography.Text className={comparisonClassName(item)}>
                    {comparisonText(item)}
                  </Typography.Text>
                </Card>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
