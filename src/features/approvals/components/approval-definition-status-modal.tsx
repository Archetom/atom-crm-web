import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Descriptions, Modal, Popconfirm, Space, Spin, Tag, Typography } from "antd";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import {
  approvalDefinitionStatusColors,
  approvalDefinitionStatusLabels,
} from "../model/approval-definition-labels";
import type { ApprovalDefinitionStatus } from "../model/approval-definition-list-item";
import { approvalDefinitionKeys } from "../model/approval-definition-query-keys";

interface ApprovalDefinitionStatusModalProps {
  definitionId: number | null;
  definitionName: string | null;
  onClose: () => void;
}

/** Updates only the server-returned status/version baseline after explicit confirmation. */
export function ApprovalDefinitionStatusModal({
  definitionId,
  definitionName,
  onClose,
}: Readonly<ApprovalDefinitionStatusModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "approval-definition-status";
  const canManageApprovals = hasAuthority(authorization, authority.approvalsManage);
  const baselineQuery = useQuery({
    queryKey: approvalDefinitionKeys.status(identityKey, definitionId ?? 0),
    queryFn: () =>
      definitionId === null || apiClient === null
        ? Promise.reject(new Error("审批定义状态暂时不可用。"))
        : apiClient.getApprovalDefinitionStatus(definitionId),
    enabled: definitionId !== null && apiClient !== null && canManageApprovals,
  });
  const statusMutation = useMutation({
    mutationFn: (status: ApprovalDefinitionStatus) =>
      apiClient === null || definitionId === null || baselineQuery.data === undefined
        ? Promise.reject(new Error("审批定义状态暂时不可用。"))
        : apiClient.updateApprovalDefinitionStatus(definitionId, {
            status,
            version: baselineQuery.data.version,
          }),
    onSuccess: (baseline) => {
      queryClient.setQueryData(approvalDefinitionKeys.status(identityKey, baseline.id), baseline);
      void queryClient.invalidateQueries({ queryKey: approvalDefinitionKeys.all });
      onClose();
    },
  });
  const baseline = baselineQuery.data;

  function statusAction(target: "ACTIVE" | "DELETED" | "INACTIVE") {
    if (target === "ACTIVE")
      return { button: "启用定义", confirmation: "确认启用", title: "确认启用该审批定义？" };
    if (target === "INACTIVE")
      return { button: "停用定义", confirmation: "确认停用", title: "确认停用该审批定义？" };
    return {
      button: "删除定义",
      confirmation: "确认删除",
      title: "确认删除该审批定义？此操作不可恢复。",
    };
  }

  const actions =
    baseline === undefined || baseline.status === "DELETED"
      ? []
      : baseline.status === "ACTIVE"
        ? ["INACTIVE" as const]
        : ["ACTIVE" as const, "DELETED" as const];

  return (
    <Modal
      destroyOnHidden
      footer={null}
      open={definitionId !== null}
      title="管理审批定义状态"
      onCancel={onClose}
    >
      <Typography.Paragraph type="secondary">
        只读取服务端返回的定义 ID、状态和 version
        作为状态操作基线；不会读取或展示步骤、条件、成员/部门范围、描述、重复规则或时间。服务端继续复核定义引用、对象约束和并发版本。
      </Typography.Paragraph>
      {baselineQuery.isLoading ? <Spin /> : null}
      {baselineQuery.isError ? (
        <Alert
          title={
            baselineQuery.error instanceof ApiError
              ? baselineQuery.error.message
              : "审批定义状态暂时无法加载"
          }
          showIcon
          type="error"
        />
      ) : null}
      {statusMutation.isError ? (
        <Alert
          title={
            statusMutation.error instanceof ApiError
              ? statusMutation.error.message
              : "审批定义状态暂时无法更新"
          }
          showIcon
          type="error"
        />
      ) : null}
      {baseline !== undefined ? (
        <>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="定义名称">{definitionName ?? "审批定义"}</Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={approvalDefinitionStatusColors[baseline.status]}>
                {approvalDefinitionStatusLabels[baseline.status]}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
          {actions.length > 0 ? (
            <Space style={{ marginTop: 12 }} wrap>
              {actions.map((target) => {
                const action = statusAction(target);
                return (
                  <Popconfirm
                    key={target}
                    cancelText="取消"
                    okButtonProps={{ danger: target === "DELETED" }}
                    okText={action.confirmation}
                    title={action.title}
                    onConfirm={() => statusMutation.mutate(target)}
                  >
                    <Button danger={target === "DELETED"} loading={statusMutation.isPending}>
                      {action.button}
                    </Button>
                  </Popconfirm>
                );
              })}
            </Space>
          ) : (
            <Typography.Text type="secondary">该定义已删除，无法再变更状态。</Typography.Text>
          )}
        </>
      ) : null}
    </Modal>
  );
}
