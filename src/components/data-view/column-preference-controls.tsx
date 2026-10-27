import { SettingOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Modal, Space, Spin, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { decodeFieldLayout, type FieldLayout } from "~/components/dynamic-field";

import {
  fieldLayoutUpdateForColumns,
  visibleColumnCodes,
  type ColumnPreferenceOption,
} from "./column-preference";

export type { ColumnPreferenceOption } from "./column-preference";

interface ColumnPreferenceControlsProps {
  objectType: string;
  options: readonly ColumnPreferenceOption[];
  onVisibleCodesChange(codes: readonly string[]): void;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function ColumnPreferenceControls({
  objectType,
  options,
  onVisibleCodesChange,
}: Readonly<ColumnPreferenceControlsProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const queryKey = ["field-layout", identityKey, objectType] as const;
  const canReadFieldLayout = hasAuthority(authorization, authority.fieldsRead);
  const [open, setOpen] = useState(false);
  const [draftVisibleCodes, setDraftVisibleCodes] = useState<string[]>([]);
  const layoutQuery = useQuery({
    queryKey,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("字段显示设置暂时不可用。"))
        : apiClient.getFieldLayout(objectType),
    enabled: apiClient !== null && canReadFieldLayout,
  });
  const visibleCodes = useMemo(
    () => visibleColumnCodes(options, layoutQuery.data),
    [layoutQuery.data, options],
  );
  const visibleCodeKey = visibleCodes.join("\u0000");
  const updateMutation = useMutation({
    mutationFn: () => {
      const layout = layoutQuery.data;
      if (apiClient === null || layout === undefined) {
        return Promise.reject(new Error("字段显示设置暂时不可用。"));
      }
      return apiClient.updateFieldLayoutDefinition(
        objectType,
        fieldLayoutUpdateForColumns(layout, options, draftVisibleCodes),
      );
    },
    onSuccess: (response) => {
      queryClient.setQueryData<FieldLayout>(queryKey, decodeFieldLayout(response));
      message.success("字段显示设置已更新");
      setOpen(false);
    },
  });

  useEffect(() => {
    onVisibleCodesChange(visibleCodes);
  }, [onVisibleCodesChange, visibleCodeKey, visibleCodes]);

  if (!canReadFieldLayout) return null;

  function openEditor() {
    setDraftVisibleCodes(visibleCodes);
    updateMutation.reset();
    setOpen(true);
  }

  function toggle(code: string, checked: boolean) {
    setDraftVisibleCodes((current) =>
      checked ? [...current, code] : current.filter((candidate) => candidate !== code),
    );
  }

  return (
    <>
      <Button icon={<SettingOutlined />} loading={layoutQuery.isLoading} onClick={openEditor}>
        字段设置
      </Button>
      <Modal
        destroyOnHidden
        footer={
          <Space>
            <Button disabled={updateMutation.isPending} onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              disabled={draftVisibleCodes.length === 0 || layoutQuery.data === undefined}
              loading={updateMutation.isPending}
              type="primary"
              onClick={() => updateMutation.mutate()}
            >
              保存显示
            </Button>
          </Space>
        }
        open={open}
        title="字段显示设置"
        onCancel={() => setOpen(false)}
      >
        <Typography.Paragraph type="secondary">
          仅修改当前成员在此列表中的字段显示，不会改变字段权限、数据范围或其他成员的布局。
        </Typography.Paragraph>
        {layoutQuery.isLoading ? <Spin /> : null}
        {layoutQuery.isError ? (
          <Alert
            title={errorMessage(layoutQuery.error, "字段显示设置暂时无法加载")}
            showIcon
            type="error"
          />
        ) : null}
        {updateMutation.isError ? (
          <Alert
            title={errorMessage(updateMutation.error, "字段显示设置暂时无法保存")}
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
        {layoutQuery.data ? (
          <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
            {options.map((option) => {
              const checked = draftVisibleCodes.includes(option.code);
              return (
                <Checkbox
                  checked={checked}
                  disabled={checked && draftVisibleCodes.length === 1}
                  key={option.code}
                  onChange={(event) => toggle(option.code, event.target.checked)}
                >
                  {option.label}
                </Checkbox>
              );
            })}
          </Space>
        ) : null}
      </Modal>
    </>
  );
}
