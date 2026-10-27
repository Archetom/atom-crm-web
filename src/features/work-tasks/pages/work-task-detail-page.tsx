import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  defaultPageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";

import { workTaskCommentKeys } from "../model/comment-query-keys";
import { workTaskKeys } from "../model/query-keys";
import {
  toWorkTaskBusinessRecord,
  workTaskBusinessRecordLabel,
  workTaskBusinessRecordOptions,
  type WorkTaskBusinessRecord,
  type WorkTaskBusinessRecordType,
} from "../model/work-task-business-record";
import {
  toWorkTaskCommentListItem,
  type WorkTaskCommentListItem,
} from "../model/work-task-comment-list-item";
import { WorkTaskFollowersModal } from "../components/work-task-followers-modal";
import { WorkTaskAttachmentsModal } from "../components/work-task-attachments-modal";
import { WorkTaskRemindersModal } from "../components/work-task-reminders-modal";

import styles from "./work-task-detail-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

function displayValue(value: string | null): string {
  return value ?? "—";
}

type WorkTaskProgressAction = "start" | "return-to-todo" | "complete";

interface BusinessRecordFormValues {
  businessObjectType?: WorkTaskBusinessRecordType;
  businessRecordId?: number;
}

const commentRequest = { page: 1, size: 20 };

export function WorkTaskDetailPage() {
  const { taskId: taskIdParam } = useParams();
  const taskId = parseRouteId(taskIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [commentDraft, setCommentDraft] = useState("");
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [assigneeMemberKeyword, setAssigneeMemberKeyword] = useState("");
  const [followersPickerOpen, setFollowersPickerOpen] = useState(false);
  const [businessRecordPickerOpen, setBusinessRecordPickerOpen] = useState(false);
  const [attachmentsPickerOpen, setAttachmentsPickerOpen] = useState(false);
  const [remindersPickerOpen, setRemindersPickerOpen] = useState(false);
  const [businessRecordForm] = Form.useForm<BusinessRecordFormValues>();
  const identityKey = authState?.identityKey ?? "pending";
  const canReadWorkTasks = hasAuthority(authorization, authority.workTasksRead);
  const canWriteWorkTasks = hasAuthority(authorization, authority.workTasksWrite);
  const canManageWorkTasks = hasAuthority(authorization, authority.workTasksManage);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canReadTaskAttachments = hasAuthority(authorization, authority.filesRead);
  const canWriteTaskAttachments =
    canWriteWorkTasks && hasAuthority(authorization, authority.filesWrite);
  const taskQuery = useQuery({
    queryKey: workTaskKeys.detail(identityKey, taskId ?? 0),
    queryFn: () =>
      apiClient === null || taskId === null
        ? Promise.reject(new Error("Work 任务详情暂时不可用。"))
        : apiClient.getWorkTask(taskId),
    enabled: apiClient !== null && taskId !== null && canReadWorkTasks,
  });
  const progressMutation = useMutation({
    mutationFn: ({ action, version }: { action: WorkTaskProgressAction; version: number }) => {
      if (apiClient === null || taskId === null) {
        return Promise.reject(new Error("Work 任务状态更新暂时不可用。"));
      }
      const request = { version };
      if (action === "start") return apiClient.startWorkTask(taskId, request);
      if (action === "return-to-todo") return apiClient.returnWorkTaskToTodo(taskId, request);
      return apiClient.completeWorkTask(taskId, request);
    },
    onSuccess: (updatedTask) => {
      queryClient.setQueryData(workTaskKeys.detail(identityKey, updatedTask.id), updatedTask);
      void queryClient.invalidateQueries({ queryKey: workTaskKeys.lists(identityKey) });
    },
  });
  const assigneeMemberQuery = useQuery({
    queryKey: [
      "member-selector",
      "work-task-assignee",
      identityKey,
      assigneeMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("成员选择暂时不可用。"))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: assigneeMemberKeyword.trim() || undefined,
          }),
    enabled:
      apiClient !== null &&
      assigneePickerOpen &&
      canReadWorkTasks &&
      canWriteWorkTasks &&
      canManageWorkTasks &&
      canReadOrganization,
  });
  const assigneeMutation = useMutation({
    mutationFn: ({ actorId, version }: { actorId: number; version: number }) =>
      apiClient === null || taskId === null
        ? Promise.reject(new Error("任务处理人更新暂时不可用。"))
        : apiClient.updateWorkTaskAssignee(taskId, { assigneeActorId: actorId, version }),
    onSuccess: (updatedTask) => {
      queryClient.setQueryData(workTaskKeys.detail(identityKey, updatedTask.id), updatedTask);
      void queryClient.invalidateQueries({ queryKey: workTaskKeys.lists(identityKey) });
      void queryClient.invalidateQueries({ queryKey: workTaskCommentKeys.lists(identityKey) });
      setAssigneePickerOpen(false);
      setAssigneeMemberKeyword("");
    },
  });
  const clearBusinessRecordMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || taskId === null
        ? Promise.reject(new Error("任务业务关联更新暂时不可用。"))
        : apiClient.clearWorkTaskBusinessRecord(taskId, { version }),
    onSuccess: (updatedTask) => {
      queryClient.setQueryData(workTaskKeys.detail(identityKey, updatedTask.id), updatedTask);
      void queryClient.invalidateQueries({ queryKey: workTaskKeys.lists(identityKey) });
    },
  });
  const updateBusinessRecordMutation = useMutation({
    mutationFn: ({
      businessRecord,
      version,
    }: {
      businessRecord: WorkTaskBusinessRecord;
      version: number;
    }) =>
      apiClient === null || taskId === null
        ? Promise.reject(new Error("任务业务关联更新暂时不可用。"))
        : apiClient.updateWorkTaskBusinessRecord(taskId, {
            businessObjectType: businessRecord.objectType,
            businessRecordId: businessRecord.recordId,
            version,
          }),
    onSuccess: (updatedTask) => {
      queryClient.setQueryData(workTaskKeys.detail(identityKey, updatedTask.id), updatedTask);
      void queryClient.invalidateQueries({ queryKey: workTaskKeys.lists(identityKey) });
      businessRecordForm.resetFields();
      setBusinessRecordPickerOpen(false);
    },
  });
  const cancelMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || taskId === null
        ? Promise.reject(new Error("取消任务暂时不可用。"))
        : apiClient.cancelWorkTask(taskId, { version }),
    onSuccess: (updatedTask) => {
      queryClient.setQueryData(workTaskKeys.detail(identityKey, updatedTask.id), updatedTask);
      void queryClient.invalidateQueries({ queryKey: workTaskKeys.lists(identityKey) });
      void queryClient.invalidateQueries({ queryKey: workTaskCommentKeys.lists(identityKey) });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || taskId === null
        ? Promise.reject(new Error("删除任务暂时不可用。"))
        : apiClient.deleteWorkTask(taskId, version),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: workTaskKeys.detail(identityKey, taskId ?? 0) });
      queryClient.removeQueries({
        queryKey: workTaskCommentKeys.list(identityKey, {
          taskId: taskId ?? 0,
          ...commentRequest,
        }),
      });
      void queryClient.invalidateQueries({ queryKey: workTaskKeys.lists(identityKey) });
      navigate("/work/tasks", { replace: true });
    },
  });
  const commentQuery = useQuery({
    queryKey: workTaskCommentKeys.list(identityKey, { taskId: taskId ?? 0, ...commentRequest }),
    queryFn: () =>
      apiClient === null || taskId === null
        ? Promise.reject(new Error("任务评论暂时不可用。"))
        : apiClient.getWorkTaskComments(taskId, commentRequest),
    enabled: apiClient !== null && taskId !== null && canReadWorkTasks && taskQuery.isSuccess,
  });
  const commentCreateMutation = useMutation({
    mutationFn: (content: string) =>
      apiClient === null || taskId === null
        ? Promise.reject(new Error("发表评论暂时不可用。"))
        : apiClient.createWorkTaskComment(taskId, { content }),
    onSuccess: () => {
      setCommentDraft("");
      void queryClient.invalidateQueries({ queryKey: workTaskCommentKeys.lists(identityKey) });
    },
  });
  const commentPage: PageResult<WorkTaskCommentListItem> = commentQuery.data
    ? toPageResult(commentQuery.data, (value) => {
        const comment = toWorkTaskCommentListItem(value);
        return comment?.taskId === taskId ? comment : null;
      })
    : { ...defaultPageRequest, items: [], meta: {}, total: null };

  if (taskId === null) return <StatusPage kind="not-found" />;

  function closeAssigneePicker() {
    if (assigneeMutation.isPending) return;
    assigneeMutation.reset();
    setAssigneePickerOpen(false);
    setAssigneeMemberKeyword("");
  }

  function closeBusinessRecordPicker() {
    if (updateBusinessRecordMutation.isPending) return;
    updateBusinessRecordMutation.reset();
    businessRecordForm.resetFields();
    setBusinessRecordPickerOpen(false);
  }

  let content: ReactNode;
  if (taskQuery.isLoading) {
    content = (
      <div
        aria-label="正在加载 Work 任务详情"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  } else if (taskQuery.isError) {
    content = (
      <StatusPage
        kind={statusKindFromError(taskQuery.error)}
        onRetry={() => void taskQuery.refetch()}
      />
    );
  } else {
    const task = taskQuery.data;
    const trimmedCommentDraft = commentDraft.trim();
    content =
      task === undefined || task.id !== taskId ? (
        <StatusPage kind="not-found" />
      ) : (
        <>
          <main className={styles.page}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/work/tasks")}>
              返回 Work 任务
            </Button>
            <section className={styles.heading}>
              <Typography.Title level={2}>{task.title}</Typography.Title>
              <Typography.Text type="secondary">
                详情仅使用同一窄投影；描述、参与成员、来源和生命周期记录不会被读取、展示或缓存。业务关联仅在服务端当前回显时显示类型和记录
                ID，提醒仅在管理者主动打开独立计划编辑器时读取。任务进度操作只提交当前
                version，服务端重新核验当前处理人身份、状态与并发。
              </Typography.Text>
            </section>
            {progressMutation.isError ? (
              <Alert
                title={
                  progressMutation.error instanceof ApiError
                    ? progressMutation.error.message
                    : "任务状态暂时无法更新"
                }
                showIcon
                type="error"
              />
            ) : null}
            {clearBusinessRecordMutation.isError ? (
              <Alert
                title={
                  clearBusinessRecordMutation.error instanceof ApiError
                    ? clearBusinessRecordMutation.error.message
                    : "任务业务关联暂时无法清除"
                }
                showIcon
                type="error"
              />
            ) : null}
            {updateBusinessRecordMutation.isError ? (
              <Alert
                title={
                  updateBusinessRecordMutation.error instanceof ApiError
                    ? updateBusinessRecordMutation.error.message
                    : "任务业务关联暂时无法更新"
                }
                showIcon
                type="error"
              />
            ) : null}
            {cancelMutation.isError ? (
              <Alert
                title={
                  cancelMutation.error instanceof ApiError
                    ? cancelMutation.error.message
                    : "任务暂时无法取消"
                }
                showIcon
                type="error"
              />
            ) : null}
            {deleteMutation.isError ? (
              <Alert
                title={
                  deleteMutation.error instanceof ApiError
                    ? deleteMutation.error.message
                    : "任务暂时无法删除"
                }
                showIcon
                type="error"
              />
            ) : null}
            <Card title="基本信息">
              <Descriptions column={{ sm: 1, md: 2 }}>
                <Descriptions.Item label="任务 ID">{task.id}</Descriptions.Item>
                <Descriptions.Item label="优先级">{displayValue(task.priority)}</Descriptions.Item>
                <Descriptions.Item label="到期时间">{displayValue(task.dueTime)}</Descriptions.Item>
                <Descriptions.Item label="逾期">{task.overdue ? "是" : "否"}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  {task.status === null ? "—" : <Tag>{task.status}</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="关联业务记录">
                  {task.businessRecord === null
                    ? "未关联"
                    : `${workTaskBusinessRecordLabel(task.businessRecord.objectType)} #${task.businessRecord.recordId}`}
                </Descriptions.Item>
              </Descriptions>
            </Card>
            {canReadTaskAttachments || canWriteTaskAttachments ? (
              <Button onClick={() => setAttachmentsPickerOpen(true)}>
                {canWriteTaskAttachments ? "管理任务附件" : "查看任务附件"}
              </Button>
            ) : null}
            <ActionAuthority authority={authority.workTasksWrite}>
              <ActionAuthority authority={authority.workTasksManage}>
                {task.status === "TODO" || task.status === "IN_PROGRESS" ? (
                  <Space wrap>
                    <Button onClick={() => navigate(`/work/tasks/${task.id}/edit`)}>
                      编辑任务
                    </Button>
                    <ActionAuthority authority={authority.organizationRead}>
                      <Button
                        onClick={() => {
                          assigneeMutation.reset();
                          setAssigneePickerOpen(true);
                        }}
                      >
                        重新分配处理人
                      </Button>
                      <Button onClick={() => setFollowersPickerOpen(true)}>管理关注人</Button>
                    </ActionAuthority>
                    {task.dueTime !== null ? (
                      <Button onClick={() => setRemindersPickerOpen(true)}>管理任务提醒</Button>
                    ) : null}
                    <Popconfirm
                      cancelText="取消"
                      description="取消后任务不能恢复；页面只提交当前 version，服务端会重新校验管理资格、开放状态与并发。"
                      okText="确认取消"
                      title="确认取消任务吗？"
                      onConfirm={() => cancelMutation.mutate(task.version)}
                    >
                      <Button danger disabled={cancelMutation.isPending}>
                        取消任务
                      </Button>
                    </Popconfirm>
                    {task.status === "TODO" ? (
                      <Popconfirm
                        cancelText="取消"
                        description="仅从未开始、无评论且无附件历史的待办任务可被删除；服务端会以当前 version 再次核验全部前提。"
                        okButtonProps={{ danger: true }}
                        okText="确认删除"
                        title="确认删除任务吗？"
                        onConfirm={() => deleteMutation.mutate(task.version)}
                      >
                        <Button
                          danger
                          disabled={deleteMutation.isPending}
                          loading={deleteMutation.isPending}
                        >
                          删除任务
                        </Button>
                      </Popconfirm>
                    ) : null}
                  </Space>
                ) : null}
              </ActionAuthority>
            </ActionAuthority>
            <ActionAuthority authority={authority.workTasksWrite}>
              {task.status === "TODO" || task.status === "IN_PROGRESS" ? (
                <Space wrap>
                  <Button
                    onClick={() => {
                      updateBusinessRecordMutation.reset();
                      businessRecordForm.setFieldsValue({
                        businessObjectType: task.businessRecord?.objectType,
                        businessRecordId: task.businessRecord?.recordId,
                      });
                      setBusinessRecordPickerOpen(true);
                    }}
                  >
                    {task.businessRecord === null ? "关联业务记录" : "变更业务关联"}
                  </Button>
                  {task.businessRecord === null ? null : (
                    <Popconfirm
                      cancelText="取消"
                      description="服务端会以当前 version 清除当前已回显的关联，并重新校验任务开放状态与并发。"
                      okText="清除"
                      title="确认清除业务关联吗？"
                      onConfirm={() => clearBusinessRecordMutation.mutate(task.version)}
                    >
                      <Button danger disabled={clearBusinessRecordMutation.isPending}>
                        清除业务关联
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              ) : null}
            </ActionAuthority>
            <ActionAuthority authority={authority.workTasksWrite}>
              {task.status === "TODO" || task.status === "IN_PROGRESS" ? (
                <Card title="任务进度">
                  <Space wrap>
                    {task.status === "TODO" ? (
                      <Button
                        disabled={progressMutation.isPending}
                        loading={
                          progressMutation.isPending &&
                          progressMutation.variables?.action === "start"
                        }
                        onClick={() =>
                          progressMutation.mutate({ action: "start", version: task.version })
                        }
                        type="primary"
                      >
                        开始任务
                      </Button>
                    ) : null}
                    {task.status === "IN_PROGRESS" ? (
                      <Button
                        disabled={progressMutation.isPending}
                        loading={
                          progressMutation.isPending &&
                          progressMutation.variables?.action === "return-to-todo"
                        }
                        onClick={() =>
                          progressMutation.mutate({
                            action: "return-to-todo",
                            version: task.version,
                          })
                        }
                      >
                        退回待办
                      </Button>
                    ) : null}
                    <Button
                      danger
                      disabled={progressMutation.isPending}
                      loading={
                        progressMutation.isPending &&
                        progressMutation.variables?.action === "complete"
                      }
                      onClick={() =>
                        progressMutation.mutate({ action: "complete", version: task.version })
                      }
                    >
                      完成任务
                    </Button>
                  </Space>
                </Card>
              ) : null}
            </ActionAuthority>
            <Card title="任务评论">
              <Typography.Text type="secondary">
                仅显示服务端授权返回的评论内容与创建时间；评论人和更新时间不会进入页面或缓存。当前只加载服务端分页的前
                20 条。
              </Typography.Text>
              {commentQuery.isError ? (
                <Alert
                  title={
                    commentQuery.error instanceof ApiError
                      ? commentQuery.error.message
                      : "任务评论暂时无法加载"
                  }
                  showIcon
                  style={{ marginTop: 16 }}
                  type="error"
                />
              ) : null}
              <List<WorkTaskCommentListItem>
                dataSource={commentPage.items}
                loading={commentQuery.isLoading}
                locale={{ emptyText: "暂无评论" }}
                renderItem={(comment) => (
                  <List.Item>
                    <Space
                      orientation="vertical"
                      size="small"
                      style={{ display: "flex", width: "100%" }}
                    >
                      <Typography.Paragraph style={{ marginBottom: 0 }}>
                        {comment.content}
                      </Typography.Paragraph>
                      <Typography.Text type="secondary">
                        {comment.createdTime ?? "创建时间未提供"}
                      </Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
              <ActionAuthority authority={authority.workTasksWrite}>
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Input.TextArea
                    aria-label="评论内容"
                    disabled={commentCreateMutation.isPending}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="输入评论内容"
                    value={commentDraft}
                  />
                  {commentCreateMutation.isError ? (
                    <Alert
                      title={
                        commentCreateMutation.error instanceof ApiError
                          ? commentCreateMutation.error.message
                          : "发表评论暂时无法完成"
                      }
                      showIcon
                      type="error"
                    />
                  ) : null}
                  <Button
                    disabled={trimmedCommentDraft.length === 0 || commentCreateMutation.isPending}
                    loading={commentCreateMutation.isPending}
                    onClick={() => commentCreateMutation.mutate(trimmedCommentDraft)}
                    type="primary"
                  >
                    发表评论
                  </Button>
                </Space>
              </ActionAuthority>
            </Card>
          </main>
          <Modal
            destroyOnHidden
            footer={null}
            open={assigneePickerOpen}
            title="重新分配处理人"
            onCancel={closeAssigneePicker}
          >
            <Typography.Paragraph type="secondary">
              仅显示服务端允许当前成员查看的在职成员。当前窄投影不读取处理人，选择会携带当前
              version；服务端会重新校验管理资格、任务开放状态、候选在职性与并发。
            </Typography.Paragraph>
            <Input.Search
              allowClear
              aria-label="按成员姓名搜索"
              defaultValue={assigneeMemberKeyword}
              placeholder="按成员姓名搜索"
              style={{ marginTop: 12 }}
              onSearch={(keyword) => setAssigneeMemberKeyword(keyword)}
            />
            {assigneeMemberQuery.isError ? (
              <Alert title="成员列表暂时无法加载" showIcon type="error" />
            ) : (
              <List
                dataSource={[...(assigneeMemberQuery.data ?? [])]}
                loading={assigneeMemberQuery.isLoading}
                locale={{ emptyText: "未找到可选择成员" }}
                renderItem={(member) => (
                  <List.Item
                    actions={[
                      <Button
                        disabled={assigneeMutation.isPending}
                        key={member.actorId}
                        loading={assigneeMutation.isPending}
                        type="link"
                        onClick={() =>
                          assigneeMutation.mutate({
                            actorId: member.actorId,
                            version: task.version,
                          })
                        }
                      >
                        重新分配
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      description={`成员 ${member.actorId}`}
                      title={member.displayName}
                    />
                  </List.Item>
                )}
              />
            )}
            {assigneeMutation.isError ? (
              <Alert
                title={
                  assigneeMutation.error instanceof ApiError
                    ? assigneeMutation.error.message
                    : "任务处理人暂时无法更新"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
          </Modal>
          <Modal
            destroyOnHidden
            footer={null}
            open={businessRecordPickerOpen}
            title="关联业务记录"
            onCancel={closeBusinessRecordPicker}
          >
            <Typography.Paragraph type="secondary">
              输入你已知的 CRM 记录类型和
              ID。页面不根据输入推断记录可见性；提交后服务端会重新核验该记录的当前写权限、租户、任务状态和
              version。
            </Typography.Paragraph>
            <Form<BusinessRecordFormValues>
              form={businessRecordForm}
              layout="vertical"
              onFinish={(values) => {
                const businessRecord = toWorkTaskBusinessRecord(
                  values.businessObjectType,
                  values.businessRecordId,
                );
                if (businessRecord === null || businessRecord === undefined) return;
                updateBusinessRecordMutation.mutate({ businessRecord, version: task.version });
              }}
            >
              <Form.Item
                label="关联业务类型"
                name="businessObjectType"
                rules={[{ required: true, message: "请选择关联业务类型" }]}
              >
                <Select
                  aria-label="关联业务类型"
                  disabled={updateBusinessRecordMutation.isPending}
                  options={workTaskBusinessRecordOptions}
                />
              </Form.Item>
              <Form.Item
                dependencies={["businessObjectType"]}
                label="关联业务记录 ID"
                name="businessRecordId"
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_rule, value: unknown) {
                      const type = getFieldValue("businessObjectType") as unknown;
                      if (typeof type !== "string" || type.length === 0) {
                        return Promise.reject(new Error("请先选择关联业务类型"));
                      }
                      if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
                        return Promise.reject(new Error("请输入有效的关联业务记录 ID"));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <InputNumber
                  aria-label="关联业务记录 ID"
                  disabled={updateBusinessRecordMutation.isPending}
                  min={1}
                  precision={0}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Space>
                <Button
                  disabled={updateBusinessRecordMutation.isPending}
                  onClick={closeBusinessRecordPicker}
                >
                  取消
                </Button>
                <Button
                  htmlType="submit"
                  loading={updateBusinessRecordMutation.isPending}
                  type="primary"
                >
                  保存关联
                </Button>
              </Space>
            </Form>
          </Modal>
          <WorkTaskFollowersModal
            open={followersPickerOpen}
            taskId={task.id}
            onClose={() => setFollowersPickerOpen(false)}
          />
          <WorkTaskAttachmentsModal
            open={attachmentsPickerOpen}
            taskId={task.id}
            onClose={() => setAttachmentsPickerOpen(false)}
          />
          <WorkTaskRemindersModal
            open={remindersPickerOpen}
            taskId={task.id}
            onClose={() => setRemindersPickerOpen(false)}
          />
        </>
      );
  }

  return <RouteAuthority authority={authority.workTasksRead}>{content}</RouteAuthority>;
}
