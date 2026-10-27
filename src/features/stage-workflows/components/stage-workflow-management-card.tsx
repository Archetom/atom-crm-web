import { EditOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Popconfirm, Space, Spin, Tag, Typography } from "antd";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import { type StageWorkflowDefinitionStatus } from "../model/stage-workflow-configuration";
import { stageWorkflowKeys } from "../model/query-keys";

import { StageWorkflowConfigurationModal } from "./stage-workflow-configuration-modal";

interface StageWorkflowManagementCardProps {
  onRefresh: () => void;
  workflowId: number;
}

const statusLabels: Readonly<Record<StageWorkflowDefinitionStatus, string>> = {
  ACTIVE: "启用",
  DELETED: "删除",
  INACTIVE: "停用",
};

/** Exposes configuration actions only when the matching resource baseline authorizes them. */
export function StageWorkflowManagementCard({
  onRefresh,
  workflowId,
}: Readonly<StageWorkflowManagementCardProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const identityKey = authState?.identityKey ?? "stage-workflow-management";
  const canManageWorkflows = hasAuthority(authorization, authority.workflowsManage);
  const baselineQuery = useQuery({
    queryKey: stageWorkflowKeys.editable(identityKey, workflowId),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("阶段工作流配置基线暂时不可用。"))
        : apiClient.getStageWorkflowEditableBaseline(workflowId),
    enabled: apiClient !== null && canManageWorkflows,
  });
  const statusMutation = useMutation({
    mutationFn: (status: StageWorkflowDefinitionStatus) =>
      apiClient === null || baselineQuery.data === undefined
        ? Promise.reject(new Error("阶段工作流状态暂时不可用。"))
        : apiClient.updateStageWorkflowStatus(workflowId, {
            status,
            version: baselineQuery.data.version,
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stageWorkflowKeys.all });
      void baselineQuery.refetch();
      onRefresh();
    },
  });

  if (!canManageWorkflows) return null;

  return (
    <>
      <Card title="流程配置管理">
        <Typography.Paragraph type="secondary">
          编辑和状态切换均以当前详情的服务端 `allowedActions`、目标状态与 version
          为准；前端权限仅作防御性入口守卫。
        </Typography.Paragraph>
        {baselineQuery.isLoading ? <Spin /> : null}
        {baselineQuery.isError ? (
          <Alert
            title={
              baselineQuery.error instanceof ApiError
                ? baselineQuery.error.message
                : "阶段工作流配置基线暂时无法加载"
            }
            showIcon
            type="error"
          />
        ) : null}
        {baselineQuery.data !== undefined ? (
          <Space wrap>
            {baselineQuery.data.canUpdate ? (
              <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                编辑完整配置
              </Button>
            ) : (
              <Tag>服务端未允许完整替换当前配置</Tag>
            )}
            {baselineQuery.data.canChangeStatus
              ? baselineQuery.data.allowedStatuses.map((status) => (
                  <Popconfirm
                    cancelText="取消"
                    description="服务端会重新校验资源状态、引用关系、权限和 version。"
                    key={status}
                    okText="确认"
                    title={`确认${statusLabels[status]}此流程吗？`}
                    onConfirm={() => statusMutation.mutate(status)}
                  >
                    <Button loading={statusMutation.isPending}>{statusLabels[status]}</Button>
                  </Popconfirm>
                ))
              : null}
          </Space>
        ) : null}
        {statusMutation.isError ? (
          <Alert
            action={
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  statusMutation.reset();
                  void baselineQuery.refetch();
                  onRefresh();
                }}
              >
                刷新配置
              </Button>
            }
            title={
              statusMutation.error instanceof ApiError
                ? statusMutation.error.message
                : "阶段工作流状态暂时无法更新"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
      </Card>
      <StageWorkflowConfigurationModal
        mode="edit"
        open={editOpen}
        workflowId={workflowId}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          void baselineQuery.refetch();
          onRefresh();
        }}
      />
    </>
  );
}
