import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  Input,
  List,
  Modal,
  Pagination,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { getErrorMessage } from "~/api/errors/catalog";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import { type ApprovalBatchActionResult } from "../model/approval-batch-action";
import { type ApprovalInstanceAction } from "../model/approval-pending-detail";
import { approvalPendingKeys } from "../model/approval-pending-query-keys";
import { ApprovalPendingDetailModal } from "./approval-pending-detail-modal";

interface ApprovalPendingModalProps {
  open: boolean;
  onClose: () => void;
}

type BatchAction = Extract<ApprovalInstanceAction, "APPROVE" | "REJECT">;

const pendingPageSize = 20;

const batchActionLabels: Readonly<Record<BatchAction, string>> = {
  APPROVE: "批量通过",
  REJECT: "批量驳回",
};

const batchItemStatusLabels = {
  APPLIED: "已处理",
  NOT_APPLIED: "未执行",
  REJECTED: "已拒绝",
} as const;

function batchResultMessage(result: ApprovalBatchActionResult): string {
  return result.applied
    ? `已原子处理 ${result.items.length} 项审批。`
    : "批量操作未执行，服务端未修改任何审批事项。";
}

/** Displays only the caller's currently visible pending approval projections. */
export function ApprovalPendingModal({ open, onClose }: Readonly<ApprovalPendingModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<readonly number[]>([]);
  const [batchAction, setBatchAction] = useState<BatchAction | null>(null);
  const [batchRemark, setBatchRemark] = useState("");
  const [batchResult, setBatchResult] = useState<ApprovalBatchActionResult | null>(null);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadApprovals = hasAuthority(authorization, authority.approvalsRead);
  const pendingQuery = useQuery({
    queryKey: approvalPendingKeys.list(identityKey, { page: currentPage, size: pendingPageSize }),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("审批待办暂时不可用。"))
        : apiClient.getPendingApprovals({ page: currentPage, size: pendingPageSize }),
    enabled: open && apiClient !== null && canReadApprovals,
  });
  const page = pendingQuery.data ?? { items: [], total: null };
  const selectedItems = page.items.filter((item) => selectedInstanceIds.includes(item.id));
  const selectionIsCurrent =
    selectedInstanceIds.length > 0 && selectedItems.length === selectedInstanceIds.length;

  const batchMutation = useMutation({
    mutationFn: (action: BatchAction) => {
      if (apiClient === null || !selectionIsCurrent) {
        return Promise.reject(new Error("批量审批暂时不可用。"));
      }
      if (!selectedItems.every((item) => item.allowedActions.includes(action))) {
        return Promise.reject(new Error("所选审批当前不允许该批量操作。"));
      }
      const remark = batchRemark.trim();
      return apiClient.batchActOnApprovals({
        actions: selectedItems.map((item) => ({
          action,
          instanceId: item.id,
          ...(remark.length > 0 ? { remark } : {}),
          version: item.version,
        })),
      });
    },
    onSuccess: (result) => {
      setBatchResult(result);
      if (result.applied) {
        setSelectedInstanceIds([]);
        void queryClient.invalidateQueries({ queryKey: approvalPendingKeys.all });
      }
      closeBatchAction();
    },
  });

  function closeBatchAction() {
    setBatchAction(null);
    setBatchRemark("");
    batchMutation.reset();
  }

  function beginBatchAction(action: BatchAction) {
    setBatchAction(action);
    setBatchRemark("");
    batchMutation.reset();
  }

  function toggleSelected(instanceId: number, checked: boolean) {
    setSelectedInstanceIds((current) =>
      checked
        ? current.includes(instanceId)
          ? current
          : [...current, instanceId]
        : current.filter((id) => id !== instanceId),
    );
  }

  function canBatch(action: BatchAction): boolean {
    return (
      selectionIsCurrent &&
      !batchMutation.isPending &&
      selectedItems.every((item) => item.allowedActions.includes(action))
    );
  }

  const canConfirmBatch = batchAction !== null && canBatch(batchAction);

  return (
    <>
      <Modal
        destroyOnHidden
        footer={null}
        open={open}
        title="审批待办"
        onCancel={() => {
          setBatchResult(null);
          closeBatchAction();
          setSelectedInstanceId(null);
          setSelectedInstanceIds([]);
          onClose();
        }}
      >
        <Typography.Paragraph type="secondary">
          仅显示服务端确认当前成员可见且待审批的事项。可批量选择的资格、动作和版本均来自服务端列表投影；任一项不满足条件时不会提交该批量操作。
        </Typography.Paragraph>
        {pendingQuery.isLoading ? <Spin /> : null}
        {pendingQuery.isError ? (
          <Alert
            title={
              pendingQuery.error instanceof ApiError
                ? pendingQuery.error.message
                : "审批待办暂时无法加载"
            }
            showIcon
            type="error"
          />
        ) : null}
        <List
          dataSource={page.items}
          loading={pendingQuery.isFetching && !pendingQuery.isLoading}
          locale={{ emptyText: pendingQuery.isLoading ? "" : "暂无待审批事项" }}
          renderItem={(pending) => {
            const selectable =
              pending.allowedActions.includes("APPROVE") ||
              pending.allowedActions.includes("REJECT");
            return (
              <List.Item
                actions={[
                  <Button
                    key="detail"
                    size="small"
                    onClick={() => setSelectedInstanceId(pending.id)}
                  >
                    查看详情
                  </Button>,
                ]}
                extra={
                  <Checkbox
                    aria-label={`选择${pending.title ?? "待审批事项"}`}
                    checked={selectedInstanceIds.includes(pending.id)}
                    disabled={!selectable || batchMutation.isPending}
                    onChange={(event) => toggleSelected(pending.id, event.target.checked)}
                  >
                    批量选择
                  </Checkbox>
                }
              >
                <List.Item.Meta
                  description={<Tag color="processing">待审批</Tag>}
                  title={pending.title ?? "待审批事项"}
                />
              </List.Item>
            );
          }}
        />
        {selectedInstanceIds.length > 0 ? (
          <Space style={{ marginTop: 12 }} wrap>
            <Typography.Text type="secondary">
              已选择 {selectedInstanceIds.length} 项
            </Typography.Text>
            <Button
              disabled={!canBatch("APPROVE")}
              type="primary"
              onClick={() => beginBatchAction("APPROVE")}
            >
              批量通过
            </Button>
            <Button
              danger
              disabled={!canBatch("REJECT")}
              onClick={() => beginBatchAction("REJECT")}
            >
              批量驳回
            </Button>
          </Space>
        ) : null}
        {page.total !== null && page.total > pendingPageSize ? (
          <Space style={{ marginTop: 12 }}>
            <Pagination
              current={currentPage}
              pageSize={pendingPageSize}
              showSizeChanger={false}
              total={page.total}
              onChange={(nextPage) => {
                setCurrentPage(nextPage);
                setSelectedInstanceIds([]);
              }}
            />
          </Space>
        ) : null}
        <ApprovalPendingDetailModal
          instanceId={selectedInstanceId}
          onClose={() => setSelectedInstanceId(null)}
        />
      </Modal>
      <Modal
        destroyOnHidden
        cancelText="取消"
        confirmLoading={batchMutation.isPending}
        okButtonProps={{ danger: batchAction === "REJECT", disabled: !canConfirmBatch }}
        okText={batchAction === null ? "确认" : `确认${batchActionLabels[batchAction]}`}
        open={batchAction !== null}
        title={batchAction === null ? "批量审批" : `确认${batchActionLabels[batchAction]}`}
        onCancel={closeBatchAction}
        onOk={() => {
          if (batchAction !== null) batchMutation.mutate(batchAction);
        }}
      >
        <Typography.Paragraph>
          该操作是全有或全无：服务端拒绝任一事项时不会修改任何事项，前端不会自动重试。
        </Typography.Paragraph>
        {batchMutation.isError ? (
          <Alert
            title={
              batchMutation.error instanceof ApiError
                ? batchMutation.error.message
                : "批量审批暂时无法完成"
            }
            showIcon
            type="error"
          />
        ) : null}
        <Input.TextArea
          aria-label="批量审批备注"
          maxLength={1000}
          placeholder="可选：填写同一审批备注"
          rows={3}
          value={batchRemark}
          onChange={(event) => setBatchRemark(event.target.value)}
        />
      </Modal>
      <Modal
        destroyOnHidden
        footer={<Button onClick={() => setBatchResult(null)}>关闭</Button>}
        open={batchResult !== null}
        title="批量审批结果"
        onCancel={() => setBatchResult(null)}
      >
        {batchResult === null ? null : (
          <>
            <Alert
              title={batchResultMessage(batchResult)}
              showIcon
              type={batchResult.applied ? "success" : "warning"}
            />
            <List
              dataSource={batchResult.items}
              style={{ marginTop: 12 }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    description={item.errCode === "NONE" ? "已完成" : getErrorMessage(item.errCode)}
                    title={`审批 #${item.instanceId} · ${batchItemStatusLabels[item.status]}`}
                  />
                </List.Item>
              )}
            />
          </>
        )}
      </Modal>
    </>
  );
}
