import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Checkbox, List, Modal, Pagination, Select, Spin, Typography } from "antd";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { getErrorMessage } from "~/api/errors/catalog";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";

import { type ApprovalPendingDetail } from "../model/approval-pending-detail";
import { approvalPendingKeys } from "../model/approval-pending-query-keys";
import { approvalStartKeys } from "../model/approval-start-query-keys";
import { type ApprovalRoutePreview, type ApprovalStartOption } from "../model/approval-start";

interface ApprovalStartModalProps {
  objectType: string;
  onClose: () => void;
  onStarted?: () => void;
  open: boolean;
  subjectId: number;
}

const candidatePageSize = 50;

function approvalStartError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function createIdempotencyKey(): string | null {
  if (
    typeof globalThis.crypto === "undefined" ||
    typeof globalThis.crypto.randomUUID !== "function"
  ) {
    return null;
  }
  return globalThis.crypto.randomUUID();
}

function selectedApproverMap(
  option: ApprovalStartOption,
  selectedApprovers: Readonly<Record<string, readonly number[]>>,
): Record<string, number[]> {
  return Object.fromEntries(
    option.selections.map((selection) => [
      selection.code,
      [...new Set(selectedApprovers[selection.code] ?? [])].sort((left, right) => left - right),
    ]),
  );
}

function previewFingerprint(
  option: ApprovalStartOption,
  selectedApprovers: Readonly<Record<string, readonly number[]>>,
): string {
  return JSON.stringify({
    definitionId: option.definitionId,
    selectedApprovers: selectedApproverMap(option, selectedApprovers),
  });
}

/**
 * Starts an approval only from server-provided options and record-specific candidate lists.
 * The browser never derives a starter's authority, routing facts, or approver eligibility.
 */
export function ApprovalStartModal({
  objectType,
  onClose,
  onStarted,
  open,
  subjectId,
}: Readonly<ApprovalStartModalProps>) {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<number | null>(null);
  const [selectedApprovers, setSelectedApprovers] = useState<
    Readonly<Record<string, readonly number[]>>
  >({});
  const [candidatePages, setCandidatePages] = useState<Readonly<Record<string, number>>>({});
  const [preview, setPreview] = useState<ApprovalRoutePreview | null>(null);
  const [previewedFingerprint, setPreviewedFingerprint] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [startedApproval, setStartedApproval] = useState<ApprovalPendingDetail | null>(null);
  const [idempotencyUnavailable, setIdempotencyUnavailable] = useState(false);
  const optionsQuery = useQuery({
    queryKey: approvalStartKeys.options(identityKey, objectType, subjectId),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("审批发起选项暂时不可用。"))
        : apiClient.getApprovalStartOptions(objectType, subjectId),
    enabled: open && apiClient !== null,
  });
  const selectedOption =
    selectedDefinitionId === null
      ? null
      : (optionsQuery.data?.options.find(
          (option) => option.definitionId === selectedDefinitionId,
        ) ?? null);
  const candidateQueries = useQueries({
    queries: (selectedOption?.selections ?? []).map((selection) => {
      const page = candidatePages[selection.code] ?? 1;
      return {
        enabled: open && apiClient !== null,
        queryFn: () =>
          apiClient === null || selectedOption === null
            ? Promise.reject(new Error("审批人候选暂时不可用。"))
            : apiClient.getApprovalStartSelectionCandidates(
                objectType,
                subjectId,
                selectedOption.definitionId,
                selection.code,
                { page, size: candidatePageSize },
              ),
        queryKey: approvalStartKeys.candidates(
          identityKey,
          objectType,
          subjectId,
          selectedOption?.definitionId ?? 0,
          selection.code,
          page,
          candidatePageSize,
        ),
      };
    }),
  });
  const previewMutation = useMutation({
    mutationFn: ({
      option,
      selected,
    }: {
      fingerprint: string;
      option: ApprovalStartOption;
      selected: Record<string, number[]>;
    }) =>
      apiClient === null
        ? Promise.reject(new Error("审批路由预览暂时不可用。"))
        : apiClient.previewApprovalRoute(option.definitionId, {
            selectedApprovers: selected,
            subjectId,
          }),
    onSuccess: (nextPreview, variables) => {
      setPreview(nextPreview);
      setPreviewedFingerprint(variables.fingerprint);
    },
  });
  const submitMutation = useMutation({
    mutationFn: ({
      option,
      selected,
      nextIdempotencyKey,
    }: {
      option: ApprovalStartOption;
      selected: Record<string, number[]>;
      nextIdempotencyKey: string;
    }) =>
      apiClient === null
        ? Promise.reject(new Error("审批发起暂时不可用。"))
        : apiClient.submitApproval({
            definitionId: option.definitionId,
            idempotencyKey: nextIdempotencyKey,
            selectedApprovers: selected,
            subjectId,
          }),
    onSuccess: (approval) => {
      setStartedApproval(approval);
      void queryClient.invalidateQueries({ queryKey: approvalPendingKeys.all });
      void queryClient.invalidateQueries({
        queryKey: approvalStartKeys.options(identityKey, objectType, subjectId),
      });
      onStarted?.();
    },
  });

  const selectionQueriesReady = candidateQueries.every(
    (query) => !query.isLoading && !query.isError && query.data !== undefined,
  );
  const selectionsComplete =
    selectedOption !== null &&
    selectedOption.selections.every(
      (selection) => (selectedApprovers[selection.code]?.length ?? 0) > 0,
    );
  const currentFingerprint =
    selectedOption === null ? null : previewFingerprint(selectedOption, selectedApprovers);
  const previewIsCurrent =
    preview !== null &&
    preview.executable &&
    selectedOption !== null &&
    preview.definitionId === selectedOption.definitionId &&
    preview.subjectId === subjectId &&
    previewedFingerprint === currentFingerprint;
  const canPreview =
    selectedOption !== null &&
    selectionsComplete &&
    selectionQueriesReady &&
    !previewMutation.isPending &&
    !submitMutation.isPending;
  const canSubmit = previewIsCurrent && !submitMutation.isPending;

  function reset() {
    setCandidatePages({});
    setIdempotencyKey(null);
    setIdempotencyUnavailable(false);
    setPreview(null);
    setPreviewedFingerprint(null);
    setSelectedApprovers({});
    setSelectedDefinitionId(null);
    setStartedApproval(null);
    previewMutation.reset();
    submitMutation.reset();
  }

  function close() {
    if (previewMutation.isPending || submitMutation.isPending) return;
    reset();
    onClose();
  }

  function chooseDefinition(definitionId: number) {
    setCandidatePages({});
    setIdempotencyKey(null);
    setIdempotencyUnavailable(false);
    setPreview(null);
    setPreviewedFingerprint(null);
    setSelectedApprovers({});
    setSelectedDefinitionId(definitionId);
    previewMutation.reset();
    submitMutation.reset();
  }

  function setApprovers(selectionCode: string, actorIds: readonly (number | string)[]) {
    const nextActorIds = [
      ...new Set(actorIds.filter((id): id is number => typeof id === "number")),
    ].sort((left, right) => left - right);
    setSelectedApprovers((current) => ({ ...current, [selectionCode]: nextActorIds }));
    setIdempotencyKey(null);
    setIdempotencyUnavailable(false);
    setPreview(null);
    setPreviewedFingerprint(null);
    previewMutation.reset();
    submitMutation.reset();
  }

  function requestPreview() {
    if (selectedOption === null || !canPreview) return;
    setPreview(null);
    setPreviewedFingerprint(null);
    previewMutation.reset();
    const selected = selectedApproverMap(selectedOption, selectedApprovers);
    previewMutation.mutate({
      fingerprint: previewFingerprint(selectedOption, selected),
      option: selectedOption,
      selected,
    });
  }

  function submit() {
    if (selectedOption === null || !canSubmit) return;
    const nextIdempotencyKey = idempotencyKey ?? createIdempotencyKey();
    if (nextIdempotencyKey === null) {
      setIdempotencyUnavailable(true);
      return;
    }
    setIdempotencyKey(nextIdempotencyKey);
    setIdempotencyUnavailable(false);
    submitMutation.mutate({
      option: selectedOption,
      selected: selectedApproverMap(selectedOption, selectedApprovers),
      nextIdempotencyKey,
    });
  }

  return (
    <Modal
      cancelText={startedApproval === null ? "取消" : undefined}
      destroyOnHidden
      footer={
        startedApproval !== null ? (
          <Button type="primary" onClick={close}>
            完成
          </Button>
        ) : (
          <>
            <Button
              disabled={previewMutation.isPending || submitMutation.isPending}
              onClick={close}
            >
              取消
            </Button>
            <Button
              disabled={!canPreview}
              loading={previewMutation.isPending}
              onClick={requestPreview}
            >
              预览路由
            </Button>
            <Button
              disabled={!canSubmit}
              loading={submitMutation.isPending}
              type="primary"
              onClick={submit}
            >
              发起审批
            </Button>
          </>
        )
      }
      open={open}
      title="发起审批"
      width={680}
      onCancel={close}
    >
      {startedApproval !== null ? (
        <Alert
          description="服务端已受理本次发起请求。审批状态与后续待办仍以服务端可见范围为准。"
          title={`已发起“${startedApproval.title ?? "审批"}”`}
          showIcon
          type="success"
        />
      ) : (
        <>
          <Typography.Paragraph type="secondary">
            可发起的审批定义、审批人候选和路由可执行性均由服务端按当前记录与当前成员确认；提交会使用幂等键，且不会自动重试。
          </Typography.Paragraph>
          {optionsQuery.isLoading ? <Spin /> : null}
          {optionsQuery.isError ? (
            <Alert
              title={approvalStartError(optionsQuery.error, "审批发起选项暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          {optionsQuery.data !== undefined ? (
            <>
              {optionsQuery.data.options.length === 0 ? (
                <Alert title="当前记录没有可发起的审批定义。" showIcon type="info" />
              ) : (
                <Select
                  aria-label="选择审批定义"
                  optionFilterProp="label"
                  options={optionsQuery.data.options.map((option) => ({
                    label: option.name,
                    value: option.definitionId,
                  }))}
                  placeholder="选择审批定义"
                  style={{ width: "100%" }}
                  value={selectedDefinitionId ?? undefined}
                  onChange={chooseDefinition}
                />
              )}
            </>
          ) : null}
          {selectedOption !== null ? (
            <List
              dataSource={selectedOption.selections}
              header="选择审批人"
              locale={{ emptyText: "该审批定义无需额外选择审批人。" }}
              style={{ marginTop: 16 }}
              renderItem={(selection, index) => {
                const query = candidateQueries[index];
                const page = candidatePages[selection.code] ?? 1;
                const candidates = query?.data;
                return (
                  <List.Item>
                    <div style={{ width: "100%" }}>
                      <Typography.Text strong>{selection.name}</Typography.Text>
                      {query?.isLoading ? <Spin size="small" style={{ marginLeft: 8 }} /> : null}
                      {query?.isError ? (
                        <Alert
                          title={approvalStartError(query.error, "审批人候选暂时无法加载")}
                          showIcon
                          style={{ marginTop: 8 }}
                          type="error"
                        />
                      ) : null}
                      {candidates !== undefined ? (
                        <>
                          <Checkbox.Group
                            options={candidates.candidates.map((candidate) => ({
                              label: candidate.displayName,
                              value: candidate.actorId,
                            }))}
                            style={{ display: "grid", gap: 8, marginTop: 8 }}
                            value={[...(selectedApprovers[selection.code] ?? [])]}
                            onChange={(actorIds) => setApprovers(selection.code, actorIds)}
                          />
                          {candidates.total > candidatePageSize ? (
                            <Pagination
                              current={page}
                              pageSize={candidatePageSize}
                              showSizeChanger={false}
                              size="small"
                              style={{ marginTop: 8 }}
                              total={candidates.total}
                              onChange={(nextPage) =>
                                setCandidatePages((current) => ({
                                  ...current,
                                  [selection.code]: nextPage,
                                }))
                              }
                            />
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </List.Item>
                );
              }}
            />
          ) : null}
          {previewMutation.isError ? (
            <Alert
              title={approvalStartError(previewMutation.error, "审批路由暂时无法预览")}
              showIcon
              style={{ marginTop: 16 }}
              type="error"
            />
          ) : null}
          {preview !== null ? (
            <Alert
              description={
                preview.executable
                  ? preview.steps.length === 0
                    ? "服务端确认该审批路由可以发起。"
                    : `服务端确认可以发起，包含：${preview.steps.map((step) => step.name).join("、")}。`
                  : getErrorMessage(preview.blockerCode ?? undefined)
              }
              title={preview.executable ? "路由可发起" : "当前路由不可发起"}
              showIcon
              style={{ marginTop: 16 }}
              type={preview.executable ? "success" : "warning"}
            />
          ) : null}
          {idempotencyUnavailable ? (
            <Alert
              title="当前浏览器无法生成安全的幂等键，暂不能发起审批。"
              showIcon
              style={{ marginTop: 16 }}
              type="error"
            />
          ) : null}
          {submitMutation.isError ? (
            <Alert
              title={approvalStartError(submitMutation.error, "审批暂时无法发起")}
              showIcon
              style={{ marginTop: 16 }}
              type="error"
            />
          ) : null}
        </>
      )}
    </Modal>
  );
}
