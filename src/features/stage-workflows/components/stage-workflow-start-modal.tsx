import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, List, Modal, Spin, Tag, Typography } from "antd";

import { ApiError } from "~/api/errors/api-error";
import { getErrorMessage } from "~/api/errors/catalog";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";

import { stageWorkflowRuntimeKeys } from "../model/stage-workflow-runtime-query-keys";

interface StageWorkflowStartModalProps {
  objectType: string;
  onClose: () => void;
  onStarted: (workflowRecordId: number) => void;
  open: boolean;
  recordId: number;
}

function workflowStartError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Starts only a workflow that the server marks canStart for this exact business record. */
export function StageWorkflowStartModal({
  objectType,
  onClose,
  onStarted,
  open,
  recordId,
}: Readonly<StageWorkflowStartModalProps>) {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const identityKey = authState?.identityKey ?? "pending";
  const workflowsQuery = useQuery({
    queryKey: stageWorkflowRuntimeKeys.applicable(identityKey, objectType, recordId),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("可启动阶段工作流暂时不可用。"))
        : apiClient.getApplicableStageWorkflows(objectType, recordId),
    enabled: open && apiClient !== null,
  });
  const startMutation = useMutation({
    mutationFn: (workflowId: number) =>
      apiClient === null
        ? Promise.reject(new Error("阶段工作流暂时无法启动。"))
        : apiClient.startStageWorkflow(workflowId, recordId),
    onSuccess: (workflowRecord) => onStarted(workflowRecord.id),
  });

  function close() {
    if (!startMutation.isPending) onClose();
  }

  return (
    <Modal destroyOnHidden footer={null} open={open} title="启动阶段工作流" onCancel={close}>
      <Typography.Paragraph type="secondary">
        仅展示服务端确认适用于当前客户的流程。是否可启动完全由 `canStart`
        决定，服务端会在提交时再次校验记录可见性和流程适用性。
      </Typography.Paragraph>
      {workflowsQuery.isLoading ? <Spin /> : null}
      {workflowsQuery.isError ? (
        <Alert
          title={workflowStartError(workflowsQuery.error, "可启动流程暂时无法加载")}
          showIcon
          type="error"
        />
      ) : null}
      {workflowsQuery.data !== undefined ? (
        <List
          dataSource={workflowsQuery.data.workflows}
          locale={{ emptyText: "当前客户没有服务端适用的阶段工作流。" }}
          renderItem={(workflow) => (
            <List.Item
              actions={[
                workflow.canStart ? (
                  <Button
                    key="start"
                    loading={startMutation.isPending}
                    type="primary"
                    onClick={() => startMutation.mutate(workflow.workflowId)}
                  >
                    启动
                  </Button>
                ) : (
                  <Tag key="unavailable" color="default">
                    {getErrorMessage(workflow.blockerCode ?? undefined)}
                  </Tag>
                ),
              ]}
            >
              <List.Item.Meta
                description={workflow.canStart ? "可由服务端启动" : "当前不可启动"}
                title={workflow.name}
              />
            </List.Item>
          )}
        />
      ) : null}
      {startMutation.isError ? (
        <Alert
          title={workflowStartError(startMutation.error, "阶段工作流暂时无法启动")}
          showIcon
          style={{ marginTop: 16 }}
          type="error"
        />
      ) : null}
    </Modal>
  );
}
