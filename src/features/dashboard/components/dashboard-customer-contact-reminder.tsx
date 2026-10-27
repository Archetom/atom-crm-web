import { Alert, Button, Card, Empty, Skeleton, Typography } from "antd";

import type { components } from "~/api/generated/schema";

import styles from "./dashboard-customer-contact-reminder.module.css";

type CustomerContactReminder = components["schemas"]["CustomerContactReminderResponse"];
type ReminderBucket = components["schemas"]["CustomerContactReminderBucketResponse"];
type DashboardDataScope = components["schemas"]["DashboardOverviewResponse"]["preferredDataScope"];

const bucketLabels: Record<ReminderBucket["bucket"], string> = {
  OVER_7_DAYS: "超过7天未联系",
  OVER_15_DAYS: "超过15天未联系",
  OVER_30_DAYS: "超过30天未联系",
  OVER_3_MONTHS: "超过3个月未联系警告",
  OVER_6_MONTHS: "超过6个月未联系警告",
  OVERDUE: "逾期未联系已逾期",
};

const scopeLabels: Record<DashboardDataScope, string> = {
  SELF: "仅自己",
  DEPARTMENT: "本部门",
  DEPARTMENT_SUBTREE: "本人及下属",
  TENANT: "全租户（受实际权限收窄）",
};

/** Renders server-owned contact thresholds without exposing customer-level activity details. */
export function DashboardCustomerContactReminder({
  className,
  closeError = false,
  isError = false,
  isClosing = false,
  isLoading = false,
  onClose,
  onRetry,
  preferredDataScope,
  reminder,
}: Readonly<{
  className?: string;
  closeError?: boolean;
  isError?: boolean;
  isClosing?: boolean;
  isLoading?: boolean;
  onClose?(): void;
  onRetry?(): void;
  preferredDataScope?: DashboardDataScope;
  reminder: CustomerContactReminder | undefined;
}>) {
  return (
    <Card
      className={className}
      extra={
        onClose ? (
          <Button
            disabled={isClosing}
            loading={isClosing}
            size="small"
            type="link"
            onClick={onClose}
          >
            关闭
          </Button>
        ) : undefined
      }
      title={
        <Typography.Title
          id="dashboard-customer-contact-reminder-heading"
          level={2}
          style={{ fontSize: "inherit", margin: 0 }}
        >
          客户遗忘提醒
        </Typography.Title>
      }
    >
      {closeError ? <Alert title="关闭客户遗忘提醒失败" showIcon type="error" /> : null}
      {isLoading ? (
        <Skeleton active aria-label="正在加载客户遗忘提醒" />
      ) : isError ? (
        <Alert
          action={
            onRetry ? (
              <Button size="small" type="primary" onClick={onRetry}>
                重新加载
              </Button>
            ) : undefined
          }
          title="客户遗忘提醒暂时无法加载"
          showIcon
          type="error"
        />
      ) : reminder === undefined || reminder.status === "UNAVAILABLE" ? (
        <Empty
          description="当前数据范围或权限下暂不可展示客户联系提醒"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <ContactReminderContent preferredDataScope={preferredDataScope} reminder={reminder} />
      )}
    </Card>
  );
}

function ContactReminderContent({
  preferredDataScope,
  reminder,
}: Readonly<{
  preferredDataScope?: DashboardDataScope;
  reminder: CustomerContactReminder;
}>) {
  const scope = preferredDataScope ? scopeLabels[preferredDataScope] : "当前数据范围";

  return (
    <>
      <Typography.Paragraph className={styles.scope} type="secondary">
        {`${scope} · 按客户最近一次有效跟进和下次联系计划汇总`}
      </Typography.Paragraph>
      <dl aria-labelledby="dashboard-customer-contact-reminder-heading" className={styles.grid}>
        {reminder.buckets.map((bucket) => (
          <div className={styles.bucket} key={bucket.bucket}>
            <dt>{bucketLabels[bucket.bucket]}</dt>
            <dd>{bucket.count}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
