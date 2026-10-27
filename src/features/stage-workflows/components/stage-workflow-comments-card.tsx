import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Input, List, Popconfirm, Space, Typography } from "antd";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";

import { stageWorkflowRuntimeKeys } from "../model/stage-workflow-runtime-query-keys";
import { type StageWorkflowComment } from "../model/stage-workflow-comment";

interface StageWorkflowCommentsCardProps {
  canComment: boolean;
  workflowRecordId: number;
}

const commentPageRequest = { page: 1, size: 20 } as const;

function displayCreatedTime(value: string | null): string {
  return value === null ? "创建时间未提供" : value.replace("T", " ");
}

/** Uses only current server capabilities: COMMENT for creation and each comment's canDelete flag. */
export function StageWorkflowCommentsCard({
  canComment,
  workflowRecordId,
}: Readonly<StageWorkflowCommentsCardProps>) {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const identityKey = authState?.identityKey ?? "pending";
  const commentsQuery = useQuery({
    queryKey: stageWorkflowRuntimeKeys.commentList(
      identityKey,
      workflowRecordId,
      commentPageRequest,
    ),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("阶段工作流评论暂时不可用。"))
        : apiClient.getStageWorkflowComments(workflowRecordId, commentPageRequest),
    enabled: apiClient !== null,
  });
  const createMutation = useMutation({
    mutationFn: (content: string) =>
      apiClient === null
        ? Promise.reject(new Error("发表阶段工作流评论暂时不可用。"))
        : apiClient.createStageWorkflowComment(workflowRecordId, { content }),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({
        queryKey: stageWorkflowRuntimeKeys.comments(identityKey, workflowRecordId),
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (comment: StageWorkflowComment) =>
      apiClient === null
        ? Promise.reject(new Error("删除阶段工作流评论暂时不可用。"))
        : apiClient.deleteStageWorkflowComment(workflowRecordId, comment.id, comment.version),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: stageWorkflowRuntimeKeys.comments(identityKey, workflowRecordId),
      });
    },
  });
  const trimmedDraft = draft.trim();
  const comments = commentsQuery.data?.items ?? [];

  return (
    <Card title="流程评论">
      <Typography.Text type="secondary">
        仅显示服务端授权的评论内容与创建时间。发表资格仅取自运行记录的 COMMENT
        capability，删除资格仅取自每条评论的 canDelete 标记。
      </Typography.Text>
      {commentsQuery.isError ? (
        <Alert
          title={
            commentsQuery.error instanceof ApiError
              ? commentsQuery.error.message
              : "阶段工作流评论暂时无法加载"
          }
          showIcon
          style={{ marginTop: 16 }}
          type="error"
        />
      ) : null}
      <List<StageWorkflowComment>
        dataSource={comments}
        loading={commentsQuery.isLoading}
        locale={{ emptyText: "暂无评论" }}
        renderItem={(comment) => (
          <List.Item
            actions={
              comment.canDelete
                ? [
                    <Popconfirm
                      cancelText="取消"
                      description="删除后无法恢复；服务端会再次校验当前成员资格和评论版本。"
                      key="delete"
                      okButtonProps={{ danger: true }}
                      okText="确认删除"
                      title="确认删除这条评论吗？"
                      onConfirm={() => deleteMutation.mutate(comment)}
                    >
                      <Button danger disabled={deleteMutation.isPending} type="link">
                        删除
                      </Button>
                    </Popconfirm>,
                  ]
                : undefined
            }
          >
            <Space orientation="vertical" size="small" style={{ display: "flex", width: "100%" }}>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                {comment.content}
              </Typography.Paragraph>
              <Typography.Text type="secondary">
                {displayCreatedTime(comment.createdTime)}
              </Typography.Text>
            </Space>
          </List.Item>
        )}
      />
      {deleteMutation.isError ? (
        <Alert
          title={
            deleteMutation.error instanceof ApiError
              ? deleteMutation.error.message
              : "删除阶段工作流评论暂时无法完成"
          }
          showIcon
          style={{ marginTop: 16 }}
          type="error"
        />
      ) : null}
      {canComment ? (
        <Space orientation="vertical" size="small" style={{ display: "flex", marginTop: 16 }}>
          <Input.TextArea
            aria-label="流程评论内容"
            disabled={createMutation.isPending}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="输入流程评论"
            value={draft}
          />
          {createMutation.isError ? (
            <Alert
              title={
                createMutation.error instanceof ApiError
                  ? createMutation.error.message
                  : "发表阶段工作流评论暂时无法完成"
              }
              showIcon
              type="error"
            />
          ) : null}
          <Button
            disabled={trimmedDraft.length === 0 || createMutation.isPending}
            loading={createMutation.isPending}
            type="primary"
            onClick={() => createMutation.mutate(trimmedDraft)}
          >
            发表评论
          </Button>
        </Space>
      ) : null}
    </Card>
  );
}
