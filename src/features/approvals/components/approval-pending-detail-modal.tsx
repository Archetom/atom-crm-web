import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Input,
  List,
  Modal,
  Pagination,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import { approvalPendingKeys } from "../model/approval-pending-query-keys";
import {
  approvalInstanceActions,
  type ApprovalInstanceAction,
  type ApprovalTimelineTaskStatus,
} from "../model/approval-pending-detail";
import { approvalStatusLabels } from "../model/approval-status";

interface ApprovalPendingDetailModalProps {
  instanceId: number | null;
  onClose: () => void;
}

const transferCandidatePageSize = 50;

const taskStatusLabels: Readonly<Record<ApprovalTimelineTaskStatus, string>> = {
  APPROVED: "已通过",
  PENDING: "待审批",
  REJECTED: "已驳回",
  SKIPPED: "已跳过",
  TRANSFERRED: "已转审",
  WAITING: "等待中",
};

const actionLabels: Readonly<Record<ApprovalInstanceAction, string>> = {
  APPROVE: "通过",
  CANCEL: "取消审批",
  REJECT: "驳回",
  TRANSFER: "转审",
  WITHDRAW: "撤回",
};

const actionOrder = approvalInstanceActions;

function displayActedTime(value: string | null): string {
  return value === null ? "未处理" : value.replace("T", " ");
}

function actionButtonType(action: ApprovalInstanceAction): "default" | "primary" {
  return action === "APPROVE" ? "primary" : "default";
}

function actionIsDangerous(action: ApprovalInstanceAction): boolean {
  return action === "CANCEL" || action === "REJECT" || action === "WITHDRAW";
}

/**
 * Shows only a server-visible approval projection. Every action is rendered from the
 * instance's current allowedActions and submitted with its server-issued version.
 */
export function ApprovalPendingDetailModal({
  instanceId,
  onClose,
}: Readonly<ApprovalPendingDetailModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<ApprovalInstanceAction | null>(null);
  const [remark, setRemark] = useState("");
  const [transferActorId, setTransferActorId] = useState<number | null>(null);
  const [transferCandidatePage, setTransferCandidatePage] = useState(1);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadApprovals = hasAuthority(authorization, authority.approvalsRead);
  const detailQuery = useQuery({
    queryKey: approvalPendingKeys.detail(identityKey, instanceId ?? 0),
    queryFn: () =>
      apiClient === null || instanceId === null
        ? Promise.reject(new Error("审批详情暂时不可用。"))
        : apiClient.getApprovalPendingDetail(instanceId),
    enabled: instanceId !== null && apiClient !== null && canReadApprovals,
  });
  const transferCandidatesQuery = useQuery({
    queryKey: approvalPendingKeys.transferCandidates(identityKey, instanceId ?? 0, {
      page: transferCandidatePage,
      size: transferCandidatePageSize,
    }),
    queryFn: () =>
      apiClient === null || instanceId === null
        ? Promise.reject(new Error("转审候选人暂时不可用。"))
        : apiClient.getApprovalTransferCandidates(instanceId, {
            page: transferCandidatePage,
            size: transferCandidatePageSize,
          }),
    enabled:
      pendingAction === "TRANSFER" && instanceId !== null && apiClient !== null && canReadApprovals,
  });
  const actionMutation = useMutation({
    mutationFn: ({
      action,
      transferActorId: nextTransferActorId,
      version,
    }: {
      action: ApprovalInstanceAction;
      transferActorId: number | null;
      version: number;
    }) => {
      if (apiClient === null || instanceId === null) {
        return Promise.reject(new Error("审批操作暂时不可用。"));
      }
      if (action === "WITHDRAW") return apiClient.withdrawApproval(instanceId, version);
      if (action === "CANCEL") return apiClient.cancelApproval(instanceId, version);

      const trimmedRemark = remark.trim();
      return apiClient.actOnApproval(instanceId, {
        action,
        ...(trimmedRemark.length > 0 ? { remark: trimmedRemark } : {}),
        ...(action === "TRANSFER" && nextTransferActorId !== null
          ? { transferActorId: nextTransferActorId }
          : {}),
        version,
      });
    },
    onSuccess: (updatedDetail) => {
      if (instanceId !== null) {
        queryClient.setQueryData(
          approvalPendingKeys.detail(identityKey, instanceId),
          updatedDetail,
        );
      }
      void queryClient.invalidateQueries({ queryKey: approvalPendingKeys.all });
      closeAction();
    },
  });
  const detail = detailQuery.data;
  const transferCandidates = transferCandidatesQuery.data;
  const availableActions =
    detail === undefined
      ? []
      : actionOrder.filter((action) => detail.allowedActions.includes(action));

  function closeAction() {
    setPendingAction(null);
    setRemark("");
    setTransferActorId(null);
    setTransferCandidatePage(1);
    actionMutation.reset();
  }

  function beginAction(action: ApprovalInstanceAction) {
    setPendingAction(action);
    setRemark("");
    setTransferActorId(null);
    setTransferCandidatePage(1);
    actionMutation.reset();
  }

  function closeDetail() {
    closeAction();
    onClose();
  }

  const transferCandidateTotal = transferCandidates?.total ?? 0;
  const actionNeedsTransferCandidate = pendingAction === "TRANSFER";
  const canSubmitAction =
    pendingAction !== null &&
    detail !== undefined &&
    !actionMutation.isPending &&
    (!actionNeedsTransferCandidate ||
      (transferActorId !== null &&
        !transferCandidatesQuery.isLoading &&
        !transferCandidatesQuery.isError));

  return (
    <>
      <Modal
        destroyOnHidden
        footer={null}
        open={instanceId !== null}
        title="审批详情"
        onCancel={closeDetail}
      >
        <Typography.Paragraph type="secondary">
          仅显示服务端确认当前成员可见的审批状态、步骤时间线和操作资格。操作按钮完全依据服务端返回的能力与版本，不比较本地身份或任务归属。
        </Typography.Paragraph>
        {detailQuery.isLoading ? <Spin /> : null}
        {detailQuery.isError ? (
          <Alert
            title={
              detailQuery.error instanceof ApiError
                ? detailQuery.error.message
                : "审批详情暂时无法加载"
            }
            showIcon
            type="error"
          />
        ) : null}
        {detail === undefined ? null : (
          <>
            <Typography.Title level={5}>{detail.title ?? "待审批事项"}</Typography.Title>
            <Tag color={detail.status === "PENDING" ? "processing" : undefined}>
              {approvalStatusLabels[detail.status]}
            </Tag>
            <List
              dataSource={detail.tasks}
              locale={{ emptyText: "暂无可展示的审批步骤" }}
              style={{ marginTop: 12 }}
              renderItem={(task) => (
                <List.Item>
                  <List.Item.Meta
                    description={`${taskStatusLabels[task.status]} · ${displayActedTime(task.actedTime)}`}
                    title={`第 ${task.stepOrder} 步：${task.stepName}`}
                  />
                </List.Item>
              )}
            />
            {availableActions.length > 0 ? (
              <Space wrap style={{ marginTop: 12 }}>
                {availableActions.map((action) => (
                  <Button
                    key={action}
                    danger={actionIsDangerous(action)}
                    disabled={actionMutation.isPending}
                    type={actionButtonType(action)}
                    onClick={() => beginAction(action)}
                  >
                    {actionLabels[action]}
                  </Button>
                ))}
              </Space>
            ) : (
              <Typography.Paragraph style={{ marginTop: 12 }} type="secondary">
                当前没有服务端允许的审批操作。
              </Typography.Paragraph>
            )}
          </>
        )}
      </Modal>
      <Modal
        destroyOnHidden
        okText={pendingAction === null ? "确认" : `确认${actionLabels[pendingAction]}`}
        open={pendingAction !== null}
        title={pendingAction === null ? "审批操作" : `确认${actionLabels[pendingAction]}`}
        cancelText="取消"
        confirmLoading={actionMutation.isPending}
        okButtonProps={{
          danger: pendingAction !== null && actionIsDangerous(pendingAction),
          disabled: !canSubmitAction,
        }}
        onCancel={closeAction}
        onOk={() => {
          if (pendingAction !== null && detail !== undefined) {
            actionMutation.mutate({
              action: pendingAction,
              transferActorId,
              version: detail.version,
            });
          }
        }}
      >
        <Typography.Paragraph>
          服务端会在提交时重新核验当前操作资格和版本；并发冲突不会自动重试。
        </Typography.Paragraph>
        {actionMutation.isError ? (
          <Alert
            title={
              actionMutation.error instanceof ApiError
                ? actionMutation.error.message
                : "审批操作暂时无法完成"
            }
            showIcon
            type="error"
          />
        ) : null}
        {pendingAction === "TRANSFER" ? (
          <>
            <Typography.Paragraph type="secondary">
              仅可选择服务端为当前审批操作返回的转审候选人，提交时服务端会再次校验。
            </Typography.Paragraph>
            {transferCandidatesQuery.isLoading ? <Spin /> : null}
            {transferCandidatesQuery.isError ? (
              <Alert
                title={
                  transferCandidatesQuery.error instanceof ApiError
                    ? transferCandidatesQuery.error.message
                    : "转审候选人暂时无法加载"
                }
                showIcon
                type="error"
              />
            ) : null}
            <Select
              aria-label="转审成员"
              disabled={transferCandidatesQuery.isLoading || transferCandidatesQuery.isError}
              filterOption={(input, option) =>
                typeof option?.label === "string" &&
                option.label.toLocaleLowerCase().includes(input.toLocaleLowerCase())
              }
              loading={transferCandidatesQuery.isLoading}
              notFoundContent={
                transferCandidatesQuery.isLoading ? <Spin size="small" /> : "暂无可转审成员"
              }
              options={(transferCandidates?.candidates ?? []).map((candidate) => ({
                label: candidate.displayName,
                value: candidate.actorId,
              }))}
              placeholder="请选择转审成员"
              showSearch
              style={{ width: "100%" }}
              value={transferActorId ?? undefined}
              onChange={(value: number) => setTransferActorId(value)}
            />
            {transferCandidateTotal > transferCandidatePageSize ? (
              <Pagination
                current={transferCandidatePage}
                pageSize={transferCandidatePageSize}
                showSizeChanger={false}
                size="small"
                style={{ marginTop: 12 }}
                total={transferCandidateTotal}
                onChange={(page) => {
                  setTransferActorId(null);
                  setTransferCandidatePage(page);
                }}
              />
            ) : null}
          </>
        ) : null}
        {pendingAction === "APPROVE" || pendingAction === "REJECT" ? (
          <Input.TextArea
            aria-label="审批备注"
            maxLength={1000}
            placeholder="可选：填写审批备注"
            rows={3}
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
          />
        ) : null}
      </Modal>
    </>
  );
}
