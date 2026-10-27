import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Input, Popconfirm, Select, Typography } from "antd";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";

import { stageWorkflowRuntimeKeys } from "../model/stage-workflow-runtime-query-keys";
import { type StageWorkflowOutcome } from "../model/stage-workflow-runtime";

interface StageWorkflowOutcomeCardProps {
  onRefresh: () => void;
  outcomes: readonly StageWorkflowOutcome[];
  version: number;
  workflowRecordId: number;
}

/** Finishes a record only with a same-record, server-advertised failure outcome. */
export function StageWorkflowOutcomeCard({
  onRefresh,
  outcomes,
  version,
  workflowRecordId,
}: Readonly<StageWorkflowOutcomeCardProps>) {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const [outcomeCode, setOutcomeCode] = useState(outcomes[0]?.code);
  const [remark, setRemark] = useState("");
  const selectedOutcome = outcomes.find((outcome) => outcome.code === outcomeCode) ?? null;

  const mutation = useMutation({
    mutationFn: () =>
      apiClient === null || selectedOutcome === null
        ? Promise.reject(new Error("结束阶段工作流暂时不可用。"))
        : apiClient.finishStageWorkflow(workflowRecordId, {
            outcome: selectedOutcome.code,
            ...(remark.trim().length > 0 ? { remark: remark.trim() } : {}),
            version,
          }),
    onSuccess: (record) => {
      queryClient.setQueryData(
        stageWorkflowRuntimeKeys.detail(identityKey, workflowRecordId),
        record,
      );
    },
  });
  const hasRequiredRemark = selectedOutcome?.remarkRequired === true && remark.trim().length === 0;
  const canSubmit = !mutation.isPending && selectedOutcome !== null && !hasRequiredRemark;

  return (
    <Card title="结束为未完成">
      <Typography.Paragraph type="secondary">
        仅可选择当前运行记录明确下发的结果；服务端会再次校验 FAIL capability 和 version。
      </Typography.Paragraph>
      <Select
        aria-label="失败结果"
        options={outcomes.map((outcome) => ({ label: outcome.label, value: outcome.code }))}
        style={{ marginBottom: 12, width: "100%" }}
        value={outcomeCode}
        onChange={(nextOutcome) => {
          setOutcomeCode(nextOutcome);
          mutation.reset();
        }}
      />
      {selectedOutcome !== null ? (
        <Input.TextArea
          aria-label={selectedOutcome.remarkRequired ? "失败备注（必填）" : "失败备注（可选）"}
          maxLength={selectedOutcome.remarkMaxLength}
          placeholder={selectedOutcome.remarkRequired ? "请填写失败备注" : "可选：填写失败备注"}
          showCount
          value={remark}
          onChange={(event) => {
            setRemark(event.target.value);
            mutation.reset();
          }}
        />
      ) : null}
      {mutation.isError ? (
        <Alert
          action={
            <Button
              size="small"
              type="primary"
              onClick={() => {
                mutation.reset();
                onRefresh();
              }}
            >
              刷新运行记录
            </Button>
          }
          title={
            mutation.error instanceof ApiError
              ? mutation.error.message
              : "结束阶段工作流暂时无法完成"
          }
          showIcon
          style={{ marginTop: 12 }}
          type="error"
        />
      ) : null}
      <Popconfirm
        cancelText="取消"
        description="确认后运行记录会结束为未完成，服务端会再次校验。"
        okText="确认结束"
        title="确认结束当前阶段工作流吗？"
        onConfirm={() => mutation.mutate()}
      >
        <Button disabled={!canSubmit} loading={mutation.isPending} style={{ marginTop: 12 }} danger>
          结束为未完成
        </Button>
      </Popconfirm>
    </Card>
  );
}
