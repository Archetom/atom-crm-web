import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Modal, Space, Spin, Switch, Typography } from "antd";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import { notificationPreferenceKeys } from "../model/query-keys";
import type { NotificationPreference } from "../model/notification-preference";

interface NotificationPreferencesModalProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPreferencesModal({
  open,
  onClose,
}: Readonly<NotificationPreferencesModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<NotificationPreference | null>(null);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadNotifications = hasAuthority(authorization, authority.notificationsRead);
  const preferenceQuery = useQuery({
    queryKey: notificationPreferenceKeys.current(identityKey),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("通知偏好暂时不可用。"))
        : apiClient.getNotificationPreference(),
    enabled: open && apiClient !== null && canReadNotifications,
  });
  const updateMutation = useMutation({
    mutationFn: (value: NotificationPreference) =>
      apiClient === null
        ? Promise.reject(new Error("通知偏好暂时不可用。"))
        : apiClient.updateNotificationPreference(value),
    onSuccess: (updated) => {
      queryClient.setQueryData(notificationPreferenceKeys.current(identityKey), updated);
      setDraft(null);
      onClose();
    },
  });
  const preference = draft ?? preferenceQuery.data ?? null;

  function close() {
    if (updateMutation.isPending) return;
    updateMutation.reset();
    setDraft(null);
    onClose();
  }

  return (
    <Modal
      destroyOnHidden
      footer={
        <Space>
          <Button disabled={updateMutation.isPending} onClick={close}>
            取消
          </Button>
          <Button
            disabled={preference === null}
            loading={updateMutation.isPending}
            type="primary"
            onClick={() => preference !== null && updateMutation.mutate(preference)}
          >
            保存通知偏好
          </Button>
        </Space>
      }
      open={open}
      title="通知偏好"
      onCancel={close}
    >
      <Typography.Paragraph type="secondary">
        仅调整当前成员是否接收外部邮件通知；邮箱地址、投递供应商、通道就绪状态和投递记录不会读取、展示或写入。
      </Typography.Paragraph>
      {preferenceQuery.isLoading ? <Spin /> : null}
      {preferenceQuery.isError ? (
        <Alert
          title={
            preferenceQuery.error instanceof ApiError
              ? preferenceQuery.error.message
              : "通知偏好暂时无法加载"
          }
          showIcon
          type="error"
        />
      ) : null}
      {updateMutation.isError ? (
        <Alert
          title={
            updateMutation.error instanceof ApiError
              ? updateMutation.error.message
              : "通知偏好暂时无法保存"
          }
          showIcon
          style={{ marginTop: 12 }}
          type="error"
        />
      ) : null}
      {preference !== null ? (
        <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
          <Space align="start">
            <Switch
              aria-label="接收邮件通知"
              checked={preference.emailEnabled}
              onChange={(emailEnabled) =>
                setDraft((current) => {
                  const baseline = current ?? preferenceQuery.data;
                  return baseline === undefined ? current : { ...baseline, emailEnabled };
                })
              }
            />
            <Space orientation="vertical" size={0}>
              <Typography.Text strong>接收邮件通知</Typography.Text>
              <Typography.Text type="secondary">用于服务端允许投递的外部邮件。</Typography.Text>
            </Space>
          </Space>
          <Space align="start">
            <Switch
              aria-label="接收 OA 公告邮件"
              checked={preference.oaAnnouncementEmailEnabled}
              onChange={(oaAnnouncementEmailEnabled) =>
                setDraft((current) => {
                  const baseline = current ?? preferenceQuery.data;
                  return baseline === undefined
                    ? current
                    : { ...baseline, oaAnnouncementEmailEnabled };
                })
              }
            />
            <Space orientation="vertical" size={0}>
              <Typography.Text strong>接收 OA 公告邮件</Typography.Text>
              <Typography.Text type="secondary">
                仅调整当前成员对 OA 公告邮件的选择。
              </Typography.Text>
            </Space>
          </Space>
        </Space>
      ) : null}
    </Modal>
  );
}
