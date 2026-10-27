import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Input, List, Modal, Space, Spin, Tag, Typography } from "antd";
import { useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import { workTaskCommentKeys } from "../model/comment-query-keys";
import { workTaskKeys } from "../model/query-keys";

interface WorkTaskFollowersModalProps {
  taskId: number;
  open: boolean;
  onClose: () => void;
}

const maximumFollowerCount = 50;

/**
 * Keeps the complete follower replacement baseline isolated from the task detail's narrow cache.
 * It intentionally does not decode or display the task creator, current assignee, or any relation data.
 */
export function WorkTaskFollowersModal({
  taskId,
  open,
  onClose,
}: Readonly<WorkTaskFollowersModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [memberKeyword, setMemberKeyword] = useState("");
  const [followerActorIdsDraft, setFollowerActorIdsDraft] = useState<number[] | null>(null);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadWorkTasks = hasAuthority(authorization, authority.workTasksRead);
  const canWriteWorkTasks = hasAuthority(authorization, authority.workTasksWrite);
  const canManageWorkTasks = hasAuthority(authorization, authority.workTasksManage);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canManageFollowers =
    canReadWorkTasks && canWriteWorkTasks && canManageWorkTasks && canReadOrganization;
  const followerBaselineQuery = useQuery({
    queryKey: ["work-task-follower-baseline", identityKey, taskId] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("任务关注人基线暂时不可用。"))
        : apiClient.getWorkTaskFollowerBaseline(taskId),
    enabled: apiClient !== null && open && canManageFollowers,
  });
  const memberQuery = useQuery({
    queryKey: ["member-selector", "work-task-follower", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("成员选择暂时不可用。"))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: memberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && open && canManageFollowers && followerBaselineQuery.isSuccess,
  });
  const followerActorIds =
    followerActorIdsDraft ?? followerBaselineQuery.data?.followerActorIds ?? [];
  const replaceFollowersMutation = useMutation({
    mutationFn: ({
      followerActorIds: nextFollowerActorIds,
      version,
    }: {
      followerActorIds: number[];
      version: number;
    }) =>
      apiClient === null
        ? Promise.reject(new Error("任务关注人更新暂时不可用。"))
        : apiClient.replaceWorkTaskFollowers(taskId, {
            followerActorIds: nextFollowerActorIds,
            version,
          }),
    onSuccess: (updatedTask) => {
      queryClient.setQueryData(workTaskKeys.detail(identityKey, updatedTask.id), updatedTask);
      void queryClient.invalidateQueries({ queryKey: workTaskKeys.lists(identityKey) });
      void queryClient.invalidateQueries({ queryKey: workTaskCommentKeys.lists(identityKey) });
      setFollowerActorIdsDraft(null);
      setMemberKeyword("");
      onClose();
    },
  });

  function close() {
    if (replaceFollowersMutation.isPending) return;
    replaceFollowersMutation.reset();
    setFollowerActorIdsDraft(null);
    setMemberKeyword("");
    onClose();
  }

  function addFollower(actorId: number) {
    if (followerActorIds.includes(actorId) || followerActorIds.length >= maximumFollowerCount) {
      return;
    }
    setFollowerActorIdsDraft([...followerActorIds, actorId]);
  }

  function removeFollower(actorId: number) {
    setFollowerActorIdsDraft(
      followerActorIds.filter((currentActorId) => currentActorId !== actorId),
    );
  }

  const baseline = followerBaselineQuery.data;
  const canSave =
    baseline !== undefined &&
    !followerBaselineQuery.isLoading &&
    !followerBaselineQuery.isFetching &&
    !followerBaselineQuery.isError &&
    !replaceFollowersMutation.isPending;

  return (
    <Modal
      destroyOnHidden
      footer={
        <Space>
          <Button disabled={replaceFollowersMutation.isPending} onClick={close}>
            取消
          </Button>
          <Button
            disabled={!canSave}
            loading={replaceFollowersMutation.isPending}
            type="primary"
            onClick={() => {
              if (baseline === undefined) return;
              replaceFollowersMutation.mutate({
                followerActorIds: [...followerActorIds],
                version: baseline.version,
              });
            }}
          >
            保存关注人
          </Button>
        </Space>
      }
      open={open}
      title="管理关注人"
      onCancel={close}
    >
      <Typography.Paragraph type="secondary">
        当前关注人清单由服务端完整版本基线提供。只保留成员
        ID；不读取创建人、处理人、关联或提醒。保存会提交完整去重后的关注人 ID 列表和
        version，服务端重新校验管理资格、开放状态、成员在职性与并发。
      </Typography.Paragraph>
      {followerBaselineQuery.isLoading ? <Spin /> : null}
      {followerBaselineQuery.isError ? (
        <Alert title="任务关注人基线暂时无法加载，无法安全保存" showIcon type="error" />
      ) : null}
      {baseline !== undefined ? (
        <>
          <Typography.Title level={5}>已选关注人（{followerActorIds.length}/50）</Typography.Title>
          <List
            dataSource={[...followerActorIds]}
            locale={{ emptyText: "暂无关注人" }}
            renderItem={(actorId) => (
              <List.Item
                actions={[
                  <Button
                    aria-label={`移除成员 ${actorId}`}
                    danger
                    disabled={replaceFollowersMutation.isPending}
                    key={actorId}
                    size="small"
                    type="link"
                    onClick={() => removeFollower(actorId)}
                  >
                    移除
                  </Button>,
                ]}
              >
                <Tag>成员 {actorId}</Tag>
              </List.Item>
            )}
          />
          <Typography.Title level={5}>添加关注人</Typography.Title>
          <Input.Search
            allowClear
            aria-label="按成员姓名搜索关注人"
            defaultValue={memberKeyword}
            placeholder="按成员姓名搜索"
            onSearch={(keyword) => setMemberKeyword(keyword)}
          />
          {memberQuery.isError ? (
            <Alert title="成员列表暂时无法加载" showIcon style={{ marginTop: 12 }} type="error" />
          ) : (
            <List
              dataSource={[...(memberQuery.data ?? [])]}
              loading={memberQuery.isLoading}
              locale={{ emptyText: "未找到可添加成员" }}
              renderItem={(member) => {
                const selected = followerActorIds.includes(member.actorId);
                return (
                  <List.Item
                    actions={[
                      <Button
                        disabled={
                          replaceFollowersMutation.isPending ||
                          selected ||
                          followerActorIds.length >= maximumFollowerCount
                        }
                        key={member.actorId}
                        size="small"
                        type="link"
                        onClick={() => addFollower(member.actorId)}
                      >
                        {selected ? "已选择" : "添加关注人"}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      description={`成员 ${member.actorId}`}
                      title={member.displayName}
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </>
      ) : null}
      {replaceFollowersMutation.isError ? (
        <Alert
          title={
            replaceFollowersMutation.error instanceof ApiError
              ? replaceFollowersMutation.error.message
              : "任务关注人暂时无法更新"
          }
          showIcon
          style={{ marginTop: 12 }}
          type="error"
        />
      ) : null}
    </Modal>
  );
}
