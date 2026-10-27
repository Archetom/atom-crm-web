import { Card, Empty, Radio, Select, Typography } from "antd";
import { useId, useMemo, useState } from "react";

import type { components } from "~/api/generated/schema";

import { formatMetric, formatServerAmount } from "../model/format";

import styles from "./dashboard-trend-panel.module.css";

type DashboardCard = components["schemas"]["CardResponse"];
type DashboardPoint = components["schemas"]["PointResponse"];

type TrendChartMode = "LINE" | "BAR";

const chartWidth = 720;
const chartHeight = 236;
const chartPadding = { bottom: 34, left: 32, right: 32, top: 16 };
const maximumAxisLabels = 7;

function shortPeriod(periodStart: string): string {
  return periodStart.length === 10 ? periodStart.slice(5) : periodStart;
}

function pointPosition(index: number, pointCount: number, value: number, maximum: number) {
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const x =
    pointCount <= 1 ? chartWidth / 2 : chartPadding.left + (index / (pointCount - 1)) * plotWidth;
  const y = chartPadding.top + (1 - value / maximum) * plotHeight;
  return { x, y };
}

function isAxisLabelVisible(index: number, pointCount: number): boolean {
  if (pointCount <= maximumAxisLabels) return true;

  const step = Math.ceil((pointCount - 1) / (maximumAxisLabels - 1));
  return index === 0 || index === pointCount - 1 || index % step === 0;
}

function DashboardTrendChart({
  metric,
  mode,
  points,
}: Readonly<{
  metric: string;
  mode: TrendChartMode;
  points: readonly DashboardPoint[];
}>) {
  const titleId = useId();
  const values = useMemo(() => points.map((point) => point.amount), [points]);
  const maximum = Math.max(1, ...values);
  const plotBottom = chartHeight - chartPadding.bottom;
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const positions = points.map((point, index) =>
    pointPosition(index, points.length, point.amount, maximum),
  );
  const polyline = positions.map(({ x, y }) => `${x},${y}`).join(" ");
  const barWidth = Math.min(48, Math.max(12, plotWidth / Math.max(points.length * 1.8, 1)));
  const chartTitle = `${formatMetric(metric)}金额${mode === "LINE" ? "折线图" : "柱状图"}`;

  return (
    <>
      <svg
        aria-labelledby={titleId}
        className={styles.chart}
        role="img"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        <title id={titleId}>{chartTitle}</title>
        <line
          className={styles.chartBaseline}
          x1={chartPadding.left}
          x2={chartWidth - chartPadding.right}
          y1={plotBottom}
          y2={plotBottom}
        />
        <line
          className={styles.chartGuide}
          x1={chartPadding.left}
          x2={chartWidth - chartPadding.right}
          y1={chartPadding.top + (plotBottom - chartPadding.top) / 2}
          y2={chartPadding.top + (plotBottom - chartPadding.top) / 2}
        />
        {mode === "LINE" ? (
          <>
            <polyline className={styles.line} fill="none" points={polyline} />
            {positions.map(({ x, y }, index) => (
              <circle
                className={styles.point}
                cx={x}
                cy={y}
                key={points[index]?.periodStart}
                r="4"
              />
            ))}
          </>
        ) : (
          positions.map(({ x, y }, index) => (
            <rect
              className={styles.bar}
              height={Math.max(0, plotBottom - y)}
              key={points[index]?.periodStart}
              rx="2"
              width={barWidth}
              x={x - barWidth / 2}
              y={y}
            />
          ))
        )}
        {positions.map(({ x }, index) =>
          isAxisLabelVisible(index, points.length) ? (
            <text
              className={styles.axisLabel}
              key={points[index]?.periodStart}
              textAnchor="middle"
              x={x}
              y={chartHeight - 10}
            >
              {shortPeriod(points[index]?.periodStart ?? "")}
            </text>
          ) : null,
        )}
      </svg>
      <ul className={styles.chartData}>
        {points.map((point) => (
          <li
            key={point.periodStart}
          >{`${point.periodStart}：${formatServerAmount(point.amount)} 元，数量 ${point.count}`}</li>
        ))}
      </ul>
    </>
  );
}

/** Shows the selected dashboard metric's server-returned trend points without deriving metrics locally. */
export function DashboardTrendPanel({
  card,
  cards,
  from,
  granularity,
  onSelectMetric,
  to,
}: Readonly<{
  card: DashboardCard;
  cards?: readonly DashboardCard[];
  from: string;
  granularity: string;
  onSelectMetric?(metric: string): void;
  to: string;
}>) {
  const [chartMode, setChartMode] = useState<TrendChartMode>("LINE");
  const title = `${formatMetric(card.metric)}趋势`;
  const period = `${from} 至 ${to} · 按${granularity === "DAY" ? "日" : granularity === "WEEK" ? "周" : "月"}汇总`;

  return (
    <Card
      className={styles.panel}
      title={
        <div className={styles.titleBar}>
          <Typography.Title level={2} style={{ fontSize: "inherit", margin: 0 }}>
            {title}
          </Typography.Title>
          {cards && onSelectMetric ? (
            <label className={styles.metricSelector} htmlFor="dashboard-trend-metric">
              <span>趋势指标</span>
              <Select
                aria-label="趋势指标"
                id="dashboard-trend-metric"
                options={cards.map((item) => ({
                  label: formatMetric(item.metric),
                  value: item.metric,
                }))}
                size="small"
                value={card.metric}
                onChange={(metric) => onSelectMetric(metric)}
              />
            </label>
          ) : null}
        </div>
      }
    >
      <Typography.Paragraph className={styles.period} type="secondary">
        {period}
      </Typography.Paragraph>
      {card.status === "UNAVAILABLE" ? (
        <Empty
          description="当前权限范围内暂不可展示该指标趋势"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : card.points.length === 0 ? (
        <Empty description="该时间范围内暂无趋势数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <>
          <div className={styles.chartControls}>
            <Typography.Text type="secondary">金额趋势</Typography.Text>
            <Radio.Group
              aria-label="趋势图形"
              optionType="button"
              options={[
                { label: "折线图", value: "LINE" },
                { label: "柱状图", value: "BAR" },
              ]}
              size="small"
              value={chartMode}
              onChange={(event) => setChartMode(event.target.value as TrendChartMode)}
            />
          </div>
          <DashboardTrendChart metric={card.metric} mode={chartMode} points={card.points} />
          <Typography.Text aria-live="polite" className={styles.announcer} role="status">
            {`当前以${chartMode === "LINE" ? "折线图" : "柱状图"}显示${formatMetric(card.metric)}金额趋势`}
          </Typography.Text>
        </>
      )}
    </Card>
  );
}
