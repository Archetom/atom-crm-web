import { Card, Statistic, Typography } from "antd";

import type { components } from "~/api/generated/schema";

import { formatMetric, formatServerAmount } from "../model/format";

import styles from "./dashboard-card.module.css";

interface DashboardCardProps {
  metric: string;
  status: string;
  count?: number | null;
  amount?: number | string | null;
  active?: boolean;
  onSelect?(): void;
  points: components["schemas"]["PointResponse"][];
}

function pointValues(points: DashboardCardProps["points"]): number[] {
  const hasNonZeroAmount = points.some((point) => point.amount !== 0);
  return points.map((point) => (hasNonZeroAmount ? point.amount : point.count));
}

function sparklinePath(points: DashboardCardProps["points"]): string | null {
  if (points.length < 2) return null;
  const values = pointValues(points);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 35 - ((value - min) / range) * 27;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function DashboardCard({
  metric,
  status,
  count,
  amount,
  active = false,
  onSelect,
  points,
}: Readonly<DashboardCardProps>) {
  const unavailable = status === "UNAVAILABLE";
  const primaryValue = unavailable
    ? "—"
    : count !== null && count !== undefined
      ? count
      : amount === null || amount === undefined
        ? "—"
        : formatServerAmount(amount);
  const primarySuffix =
    count !== null && count !== undefined
      ? "条"
      : amount !== null && amount !== undefined
        ? "元"
        : undefined;
  const path = unavailable ? null : sparklinePath(points);

  return (
    <Card className={`${styles.card} ${active ? styles.active : ""}`} size="small">
      {onSelect ? (
        <button
          aria-label={`查看${formatMetric(metric)}趋势`}
          aria-pressed={active}
          className={styles.selectButton}
          type="button"
          onClick={onSelect}
        />
      ) : null}
      <div className={styles.cardHeader}>
        <Typography.Text strong>{formatMetric(metric)}</Typography.Text>
        {unavailable ? <Typography.Text type="secondary">暂不可用</Typography.Text> : null}
      </div>
      <div className={styles.metricRow}>
        <div>
          <Statistic suffix={primarySuffix} value={primaryValue} />
          <Typography.Text className={styles.caption} type="secondary">
            {unavailable
              ? "当前权限范围内暂不可展示"
              : amount === null || amount === undefined
                ? "服务端未返回金额"
                : `金额 ${formatServerAmount(amount)} 元`}
          </Typography.Text>
        </div>
        <div className={styles.trend}>
          {path ? (
            <svg
              aria-hidden="true"
              className={styles.sparkline}
              preserveAspectRatio="none"
              viewBox="0 0 100 42"
            >
              <path d={path} pathLength="1" />
            </svg>
          ) : (
            <span aria-hidden="true" className={styles.emptySparkline} />
          )}
          <Typography.Text className={styles.trendSummary} type="secondary">
            {unavailable
              ? "趋势不可用"
              : points.length === 0
                ? "暂无趋势"
                : `${points.length} 个周期`}
          </Typography.Text>
        </div>
      </div>
    </Card>
  );
}
