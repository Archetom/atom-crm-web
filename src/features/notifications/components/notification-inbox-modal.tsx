import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, List, Modal, Pagination, Space, Spin, Switch, Tag, Typography } from "antd";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import {
  defaultPageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";

import { notificationInboxKeys } from "../model/notification-inbox-query-keys";
import {
  toNotificationInboxItem,
  type NotificationInboxItem,
  type NotificationInboxKind,
  type NotificationInboxPriority,
} from "../model/notification-inbox-item";

interface NotificationInboxModalProps {
  open: boolean;
  onClose: () => void;
}

const inboxPageSize = 20;

const kindLabels: Readonly<Record<NotificationInboxKind, string>> = {
  WORK_TASK_ESCALATION: "任务升级提醒",
  WORK_TASK_REMINDER: "任务提醒",
};

const priorityLabels: Readonly<Record<NotificationInboxPriority, string>> = {
  HIGH: "高",
  LOW: "低",
  NORMAL: "普通",
  URGENT: "紧急",
};

function displayDueTime(value: string): string {
  return value.replace("T", " ");
}

/**
 * Reads only the current member's Work-origin inbox facts while open. It does
 * not follow task IDs or represent external delivery, and it has no badge poll.
 */
export function NotificationInboxModal({ open, onClose }: Readonly<NotificationInboxModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadNotifications = hasAuthority(authorization, authority.notificationsRead);
  const canReadWorkTasks = hasAuthority(authorization, authority.workTasksRead);
  const inboxQuery = useQuery({
    queryKey: notificationInboxKeys.list(identityKey, {
      page: currentPage,
      size: inboxPageSize,
      unreadOnly,
    }),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("通知中心暂时不可用。"))
        : apiClient.getNotifications({ page: currentPage, size: inboxPageSize, unreadOnly }),
    enabled: open && apiClient !== null && canReadNotifications && canReadWorkTasks,
    refetchInterval: open ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
  const markReadMutation = useMutation({
    mutationFn: (notificationId: number) =>
      apiClient === null
        ? Promise.reject(new Error("通知状态暂时无法更新。"))
        : apiClient.markNotificationRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationInboxKeys.all });
    },
  });
  const page: PageResult<NotificationInboxItem> = inboxQuery.data
    ? toPageResult(inboxQuery.data, toNotificationInboxItem)
    : { ...defaultPageRequest, items: [], meta: {}, total: null };

  function changeUnreadOnly(value: boolean) {
    setUnreadOnly(value);
    setCurrentPage(1);
  }

  return (
    <Modal destroyOnHidden footer={null} open={open} title="通知中心" onCancel={onClose}>
      <Typography.Paragraph type="secondary">
        仅显示服务端确认当前成员可见的 Work
        通知事实。打开时每分钟刷新一次，关闭后不轮询；不读取任务详情、成员、提醒投影或外部投递记录。
      </Typography.Paragraph>
      <Space style={{ marginBottom: 12 }}>
        <Switch aria-label="仅显示未读通知" checked={unreadOnly} onChange={changeUnreadOnly} />
        <Typography.Text>仅显示未读</Typography.Text>
      </Space>
      {inboxQuery.isLoading ? <Spin /> : null}
      {inboxQuery.isError ? (
        <Alert
          title={
            inboxQuery.error instanceof ApiError ? inboxQuery.error.message : "通知中心暂时无法加载"
          }
          showIcon
          type="error"
        />
      ) : null}
      {markReadMutation.isError ? (
        <Alert
          title={
            markReadMutation.error instanceof ApiError
              ? markReadMutation.error.message
              : "通知状态暂时无法更新"
          }
          showIcon
          style={{ marginBottom: 12 }}
          type="error"
        />
      ) : null}
      <List<NotificationInboxItem>
        dataSource={page.items}
        loading={inboxQuery.isFetching && !inboxQuery.isLoading}
        locale={{ emptyText: inboxQuery.isLoading ? "" : "暂无通知" }}
        renderItem={(notification) => (
          <List.Item
            actions={
              notification.status === "UNREAD"
                ? [
                    <Button
                      key="read"
                      loading={
                        markReadMutation.isPending && markReadMutation.variables === notification.id
                      }
                      size="small"
                      onClick={() => markReadMutation.mutate(notification.id)}
                    >
                      标为已读
                    </Button>,
                  ]
                : [<Tag key="read">已读</Tag>]
            }
          >
            <List.Item.Meta
              description={`${kindLabels[notification.kind]} · 优先级：${priorityLabels[notification.priority]} · 到期：${displayDueTime(notification.dueTime)}`}
              title={notification.title}
            />
          </List.Item>
        )}
      />
      {page.total !== null && page.total > inboxPageSize ? (
        <Space style={{ marginTop: 12 }}>
          <Pagination
            current={currentPage}
            pageSize={inboxPageSize}
            showSizeChanger={false}
            total={page.total}
            onChange={(nextPage) => setCurrentPage(nextPage)}
          />
        </Space>
      ) : null}
    </Modal>
  );
}
