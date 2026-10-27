import { MoreOutlined } from "@ant-design/icons";
import { Button, Dropdown, Space, Tooltip, Typography } from "antd";
import type { ReactNode } from "react";

import styles from "./page-header.module.css";

export interface PageHeaderAction {
  disabled?: boolean;
  icon?: ReactNode;
  key: string;
  label: string;
  onClick(): void;
}

interface PageHeaderProps {
  description?: ReactNode;
  moreLabel?: string;
  primaryAction?: PageHeaderAction;
  secondaryActions?: readonly PageHeaderAction[];
  title: string;
}

export function PageHeader({
  description,
  moreLabel = "更多页面操作",
  primaryAction,
  secondaryActions = [],
  title,
}: Readonly<PageHeaderProps>) {
  const secondaryActionItems = secondaryActions.map((action) => ({
    disabled: action.disabled,
    icon: action.icon,
    key: action.key,
    label: action.label,
  }));

  function handleSecondaryAction(key: string) {
    secondaryActions.find((action) => action.key === key)?.onClick();
  }

  return (
    <header className={styles.root}>
      <div className={styles.copy}>
        <Typography.Title className={styles.title} level={1}>
          {title}
        </Typography.Title>
        {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
      </div>
      {primaryAction || secondaryActions.length > 0 ? (
        <div className={styles.actions}>
          {secondaryActions.length > 0 ? (
            <Space className={styles.secondaryActions} size="small" wrap>
              {secondaryActions.map((action) => (
                <Button
                  key={action.key}
                  disabled={action.disabled}
                  icon={action.icon}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </Space>
          ) : null}
          {secondaryActionItems.length > 0 ? (
            <Tooltip title={moreLabel}>
              <Dropdown
                menu={{
                  items: secondaryActionItems,
                  onClick: ({ key }) => handleSecondaryAction(key),
                }}
                trigger={["click"]}
              >
                <Button
                  aria-label={moreLabel}
                  className={styles.moreActions}
                  icon={<MoreOutlined />}
                  type="text"
                />
              </Dropdown>
            </Tooltip>
          ) : null}
          {primaryAction ? (
            <Button
              disabled={primaryAction.disabled}
              icon={primaryAction.icon}
              type="primary"
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
