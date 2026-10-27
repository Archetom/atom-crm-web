import { Card, Empty, Progress, Statistic, Typography } from "antd";
import { Link } from "react-router";

import type { components } from "~/api/generated/schema";

import { formatServerAmount } from "../model/format";

import styles from "./dashboard-target-panel.module.css";

type DashboardTarget = components["schemas"]["TargetResponse"];

function percentText(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Presents the server-owned, member-level contract target without deriving a target from cards.
 */
export function DashboardTargetPanel({
  className,
  from,
  targetManagementPath,
  target,
  to,
}: Readonly<{
  className?: string;
  from: string;
  targetManagementPath?: string;
  target: DashboardTarget;
  to: string;
}>) {
  const values =
    target.status === "AVAILABLE" &&
    typeof target.targetAmount === "number" &&
    typeof target.actualAmount === "number" &&
    typeof target.completionRate === "number"
      ? {
          actualAmount: target.actualAmount,
          completionRate: target.completionRate,
          targetAmount: target.targetAmount,
        }
      : null;
  const progress = values === null ? 0 : Math.max(0, Math.min(100, values.completionRate));

  return (
    <Card
      className={className}
      title={
        <div className={styles.titleBar}>
          <Typography.Title level={2} style={{ fontSize: "inherit", margin: 0 }}>
            合同金额目标及完成情况
          </Typography.Title>
          {targetManagementPath ? (
            <Link className={styles.targetManagementLink} to={targetManagementPath}>
              设置目标
            </Link>
          ) : null}
        </div>
      }
    >
      {target.status === "UNAVAILABLE" ? (
        <Empty
          description="当前数据范围或权限下暂不可展示目标完成情况"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : target.status === "EMPTY" ? (
        <Empty
          description="当前时间范围内未配置合同金额目标"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : values === null ? (
        <Empty description="目标数据暂不完整" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <>
          <Typography.Paragraph className={styles.period} type="secondary">
            {`${from} 至 ${to} · 仅使用当前成员的服务器目标和实际合同金额`}
          </Typography.Paragraph>
          <div className={styles.figures}>
            <Statistic
              formatter={(value) => formatServerAmount(Number(value))}
              title="目标金额"
              value={values.targetAmount}
            />
            <Statistic
              formatter={(value) => formatServerAmount(Number(value))}
              title="完成金额"
              value={values.actualAmount}
            />
            <Statistic title="完成率" value={percentText(values.completionRate)} />
          </div>
          <div className={styles.progressLabel}>
            <Typography.Text>合同金额完成进度</Typography.Text>
            <Typography.Text strong>{percentText(values.completionRate)}</Typography.Text>
          </div>
          <Progress
            aria-label="合同金额目标完成率"
            percent={progress}
            showInfo={false}
            status={values.completionRate >= 100 ? "success" : "active"}
          />
        </>
      )}
    </Card>
  );
}
