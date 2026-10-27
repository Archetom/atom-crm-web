import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Divider, Modal, Space, Spin, Typography } from "antd";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { bootstrapKeys } from "~/api/query-keys/bootstrap";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { translateTitleKey } from "~/shared/i18n/messages";

import {
  canMoveNavigationPreferenceItem,
  flattenNavigationPreferenceItems,
  reorderNavigationPreference,
  setNavigationPreferenceHidden,
  toNavigationPreferenceUpdate,
  type NavigationPreference,
} from "../model/navigation-preference";
import { navigationPreferenceKeys } from "../model/query-keys";

interface NavigationPreferencesModalProps {
  open: boolean;
  onClose: () => void;
}

export function NavigationPreferencesModal({
  open,
  onClose,
}: Readonly<NavigationPreferencesModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<NavigationPreference | null>(null);
  const identityKey = authState?.identityKey ?? "pending";
  const canRead = hasAuthority(authorization, authority.navigationRead);
  const canWrite = hasAuthority(authorization, authority.navigationWrite);
  const preferenceQuery = useQuery({
    queryKey: navigationPreferenceKeys.current(identityKey),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("菜单偏好暂时不可用。"))
        : apiClient.getNavigationPreference(),
    enabled: open && apiClient !== null && canRead,
  });
  const updateMutation = useMutation({
    mutationFn: (value: NavigationPreference) =>
      apiClient === null
        ? Promise.reject(new Error("菜单偏好暂时不可用。"))
        : apiClient.updateNavigationPreference(toNavigationPreferenceUpdate(value)),
    onSuccess: (updated) => {
      queryClient.setQueryData(navigationPreferenceKeys.current(identityKey), updated);
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: bootstrapKeys.navigation(identityKey) });
      onClose();
    },
  });
  const preference = draft ?? preferenceQuery.data ?? null;
  const items =
    preference === null ? [] : flattenNavigationPreferenceItems(preference.availableItems);

  function updateDraft(updater: (current: NavigationPreference) => NavigationPreference): void {
    setDraft((current) => {
      const baseline = current ?? preferenceQuery.data;
      return baseline === undefined ? current : updater(baseline);
    });
  }

  function close(): void {
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
            disabled={preference === null || !canWrite}
            loading={updateMutation.isPending}
            type="primary"
            onClick={() => preference !== null && updateMutation.mutate(preference)}
          >
            保存菜单偏好
          </Button>
        </Space>
      }
      open={open}
      title="菜单设置"
      width={720}
      onCancel={close}
    >
      <Typography.Paragraph type="secondary">
        仅调整当前成员已获服务端授权菜单的顺序和隐藏状态。候选项由服务端按当前权限返回；隐藏的项仍会保留在这里，以便恢复显示。
      </Typography.Paragraph>
      {!canWrite ? (
        <Alert
          title="你可以查看当前菜单偏好，但保存调整还需要 navigation:write 权限。"
          showIcon
          type="info"
        />
      ) : null}
      {preferenceQuery.isLoading ? <Spin /> : null}
      {preferenceQuery.isError ? (
        <Alert
          title={
            preferenceQuery.error instanceof ApiError
              ? preferenceQuery.error.message
              : "菜单偏好暂时无法加载"
          }
          showIcon
          style={{ marginTop: 12 }}
          type="error"
        />
      ) : null}
      {updateMutation.isError ? (
        <Alert
          title={
            updateMutation.error instanceof ApiError
              ? updateMutation.error.message
              : "菜单偏好暂时无法保存"
          }
          showIcon
          style={{ marginTop: 12 }}
          type="error"
        />
      ) : null}
      {preference !== null ? (
        <Space orientation="vertical" size="small" style={{ display: "flex", marginTop: 16 }}>
          {items.map(({ depth, item }) => {
            const label = translateTitleKey(item.titleKey, item.code);
            const hidden = preference.hiddenCodes.includes(item.code);
            return (
              <div key={item.code} style={{ marginLeft: depth * 20 }}>
                <Space align="center" wrap>
                  <Checkbox
                    aria-label={`隐藏 ${label}`}
                    checked={hidden}
                    disabled={!canWrite}
                    onChange={(event) =>
                      updateDraft((current) =>
                        setNavigationPreferenceHidden(current, item.code, event.target.checked),
                      )
                    }
                  >
                    隐藏
                  </Checkbox>
                  <Typography.Text strong={depth === 0}>{label}</Typography.Text>
                  <Typography.Text type="secondary">{item.route ?? "菜单分组"}</Typography.Text>
                  <Button
                    disabled={
                      !canWrite || !canMoveNavigationPreferenceItem(preference, item.code, "up")
                    }
                    size="small"
                    onClick={() =>
                      updateDraft((current) =>
                        reorderNavigationPreference(current, item.code, "up"),
                      )
                    }
                  >
                    上移
                  </Button>
                  <Button
                    disabled={
                      !canWrite || !canMoveNavigationPreferenceItem(preference, item.code, "down")
                    }
                    size="small"
                    onClick={() =>
                      updateDraft((current) =>
                        reorderNavigationPreference(current, item.code, "down"),
                      )
                    }
                  >
                    下移
                  </Button>
                </Space>
                <Divider style={{ margin: "8px 0" }} />
              </div>
            );
          })}
          {items.length === 0 ? (
            <Typography.Text type="secondary">暂无可调整菜单。</Typography.Text>
          ) : null}
        </Space>
      ) : null}
    </Modal>
  );
}
