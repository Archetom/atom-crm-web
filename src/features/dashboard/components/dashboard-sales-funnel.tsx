import { Alert, Button, Card, Empty, Radio, Select, Skeleton, Typography } from "antd";
import { useState } from "react";

import type { components } from "~/api/generated/schema";

import { formatServerAmount } from "../model/format";

import styles from "./dashboard-sales-funnel.module.css";

type DashboardSalesFunnel = components["schemas"]["SalesFunnelResponse"];
type FunnelPipeline = components["schemas"]["SalesFunnelPipelineResponse"];

type FunnelMode = "AMOUNT" | "COUNT";

function selectedPipeline(
  pipelines: readonly FunnelPipeline[],
  selectedCode: string | null,
): FunnelPipeline | null {
  return pipelines.find((pipeline) => pipeline.code === selectedCode) ?? pipelines[0] ?? null;
}

function stageValue(stage: FunnelPipeline["stages"][number], mode: FunnelMode): number {
  return mode === "AMOUNT" ? stage.amount : stage.count;
}

/**
 * Shows a server-grouped sales funnel while keeping pipeline and value-mode choices local to
 * the same overview snapshot. Neither choice can widen the server-decided dashboard scope.
 */
export function DashboardSalesFunnel({
  className,
  from,
  funnel,
  isError = false,
  isLoading = false,
  onRetry,
  to,
}: Readonly<{
  className?: string;
  from?: string;
  funnel: DashboardSalesFunnel | undefined;
  isError?: boolean;
  isLoading?: boolean;
  onRetry?(): void;
  to?: string;
}>) {
  const [mode, setMode] = useState<FunnelMode>("AMOUNT");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const pipeline = selectedPipeline(funnel?.pipelines ?? [], selectedCode);

  return (
    <Card
      className={className}
      title={
        <Typography.Title
          id="dashboard-sales-funnel-heading"
          level={2}
          style={{ fontSize: "inherit", margin: 0 }}
        >
          销售漏斗
        </Typography.Title>
      }
    >
      {isLoading ? (
        <Skeleton active aria-label="正在加载销售漏斗" />
      ) : isError ? (
        <Alert
          action={
            onRetry ? (
              <Button size="small" type="primary" onClick={onRetry}>
                重新加载
              </Button>
            ) : undefined
          }
          title="销售漏斗暂时无法加载"
          showIcon
          type="error"
        />
      ) : funnel === undefined || funnel.status === "UNAVAILABLE" ? (
        <Empty
          description="当前数据范围或权限下暂不可展示销售漏斗"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : funnel.status === "EMPTY" || pipeline === null ? (
        <Empty description="当前范围内没有可展示的销售流程" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <SalesFunnelContent
          from={from}
          mode={mode}
          pipeline={pipeline}
          pipelines={funnel.pipelines}
          selectedCode={pipeline.code}
          to={to}
          onModeChange={setMode}
          onPipelineChange={setSelectedCode}
        />
      )}
    </Card>
  );
}

function SalesFunnelContent({
  from,
  mode,
  pipeline,
  pipelines,
  selectedCode,
  to,
  onModeChange,
  onPipelineChange,
}: Readonly<{
  from?: string;
  mode: FunnelMode;
  pipeline: FunnelPipeline;
  pipelines: readonly FunnelPipeline[];
  selectedCode: string;
  to?: string;
  onModeChange(mode: FunnelMode): void;
  onPipelineChange(code: string): void;
}>) {
  const maximum = Math.max(1, ...pipeline.stages.map((stage) => stageValue(stage, mode)));
  const period = from && to ? `${from} 至 ${to}` : "当前看板时间范围";

  return (
    <>
      <div className={styles.controls}>
        <label className={styles.pipelineSelector} htmlFor="dashboard-sales-funnel-pipeline">
          <span>销售流程</span>
          <Select
            aria-label="销售流程"
            id="dashboard-sales-funnel-pipeline"
            options={pipelines.map((item) => ({ label: item.name, value: item.code }))}
            value={selectedCode}
            onChange={(code: string) => onPipelineChange(code)}
          />
        </label>
        <Radio.Group
          aria-label="漏斗数值类型"
          optionType="button"
          options={[
            { label: "金额", value: "AMOUNT" },
            { label: "数量", value: "COUNT" },
          ]}
          value={mode}
          onChange={(event) => onModeChange(event.target.value as FunnelMode)}
        />
      </div>
      <Typography.Paragraph className={styles.period} type="secondary">
        {`${period} · 按本期创建的活动商机汇总`}
      </Typography.Paragraph>
      <ol aria-labelledby="dashboard-sales-funnel-heading" className={styles.stages}>
        {pipeline.stages.map((stage) => {
          const value = stageValue(stage, mode);
          const width = Math.max(0, Math.min(100, (value / maximum) * 100));
          return (
            <li className={styles.stage} key={stage.code}>
              <div className={styles.stageHeader}>
                <Typography.Text strong>{stage.name}</Typography.Text>
                <Typography.Text type="secondary">成交概率 {stage.probability}%</Typography.Text>
              </div>
              <div aria-hidden="true" className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${width}%` }} />
              </div>
              <div className={styles.stageValues}>
                <Typography.Text>{`数量 ${stage.count}`}</Typography.Text>
                <Typography.Text>{`金额 ${formatServerAmount(stage.amount)} 元`}</Typography.Text>
              </div>
            </li>
          );
        })}
      </ol>
      <Typography.Text aria-live="polite" className={styles.announcer} role="status">
        {`当前查看${pipeline.name}的${mode === "AMOUNT" ? "金额" : "数量"}漏斗`}
      </Typography.Text>
    </>
  );
}
