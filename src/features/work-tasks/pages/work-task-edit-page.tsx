import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Input, Select, Space, Spin, Tag, Typography } from "antd";
import { useNavigate, useParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";

import { toWorkTaskUpdateRequest, type WorkTaskEditValues } from "../model/work-task-edit-form";
import { workTaskPriorityOptions, type WorkTaskPriority } from "../model/work-task-priority";
import { workTaskKeys } from "../model/query-keys";

import styles from "./work-task-edit-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

interface WorkTaskEditFormValues {
  title?: string;
  description?: string;
  priority?: WorkTaskPriority;
  dueTime?: string;
}

function toLocalDateTimeInputValue(value: string | null): string | undefined {
  return value === null ? undefined : value.slice(0, 16);
}

export function WorkTaskEditPage() {
  const { taskId: taskIdParam } = useParams();
  const taskId = parseRouteId(taskIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const canReadWorkTasks = hasAuthority(authorization, authority.workTasksRead);
  const canWriteWorkTasks = hasAuthority(authorization, authority.workTasksWrite);
  const canManageWorkTasks = hasAuthority(authorization, authority.workTasksManage);
  const baselineQuery = useQuery({
    queryKey: ["work-task-edit-baseline", identityKey, taskId ?? 0] as const,
    queryFn: () =>
      apiClient === null || taskId === null
        ? Promise.reject(new Error("任务编辑基线暂时不可用。"))
        : apiClient.getWorkTaskEditBaseline(taskId),
    enabled:
      apiClient !== null &&
      taskId !== null &&
      canReadWorkTasks &&
      canWriteWorkTasks &&
      canManageWorkTasks,
  });
  const updateMutation = useMutation({
    mutationFn: (values: WorkTaskEditValues) => {
      const request = toWorkTaskUpdateRequest(values);
      return apiClient === null || taskId === null || request === null
        ? Promise.reject(new Error("任务结构更新数据暂时不可用。"))
        : apiClient.updateWorkTask(taskId, request);
    },
    onSuccess: (task) => {
      queryClient.setQueryData(workTaskKeys.detail(identityKey, task.id), task);
      void queryClient.invalidateQueries({ queryKey: workTaskKeys.lists(identityKey) });
      queryClient.removeQueries({ queryKey: ["work-task-edit-baseline", identityKey, task.id] });
      navigate(`/work/tasks/${task.id}`, { replace: true });
    },
  });

  function submit(values: WorkTaskEditFormValues) {
    const baseline = baselineQuery.data;
    if (baseline === undefined || values.title === undefined || values.priority === undefined) {
      return;
    }
    updateMutation.mutate({
      description: values.description ?? "",
      ...(values.dueTime === undefined ? {} : { dueTime: values.dueTime }),
      priority: values.priority,
      title: values.title,
      version: baseline.version,
    });
  }

  if (taskId === null) return <StatusPage kind="not-found" />;

  if (baselineQuery.isLoading) {
    return (
      <div
        aria-label="正在加载任务编辑基线"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (baselineQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(baselineQuery.error)}
        onRetry={() => void baselineQuery.refetch()}
      />
    );
  }

  const baseline = baselineQuery.data;
  if (baseline === undefined || baseline.id !== taskId) return <StatusPage kind="unavailable" />;

  return (
    <RouteAuthority authority={authority.workTasksRead}>
      <RouteAuthority authority={authority.workTasksWrite}>
        <RouteAuthority authority={authority.workTasksManage}>
          <main className={styles.page}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/work/tasks/${taskId}`)}>
              返回任务详情
            </Button>
            <section>
              <Typography.Title level={2}>编辑 Work 任务</Typography.Title>
              <Typography.Text type="secondary">
                管理权限下仅读取和回写任务的标题、描述、优先级、到期时间与
                version。创建人资格不会由浏览器根据本地身份推断；服务端仍重新确认管理权限、开放状态与并发。
              </Typography.Text>
            </section>
            {updateMutation.isError ? (
              <Alert
                title={
                  updateMutation.error instanceof ApiError
                    ? updateMutation.error.message
                    : "任务结构暂时无法更新"
                }
                showIcon
                type="error"
              />
            ) : null}
            <Card title="任务结构" extra={<Tag>{baseline.status}</Tag>}>
              <Form
                initialValues={{
                  description: baseline.description,
                  dueTime: toLocalDateTimeInputValue(baseline.dueTime),
                  priority: baseline.priority,
                  title: baseline.title,
                }}
                layout="vertical"
                onFinish={submit}
              >
                <Form.Item
                  label="任务标题"
                  name="title"
                  rules={[
                    { required: true, whitespace: true, message: "请输入任务标题" },
                    { max: 200, message: "任务标题不能超过 200 个字符" },
                  ]}
                >
                  <Input
                    aria-label="任务标题"
                    disabled={updateMutation.isPending}
                    maxLength={200}
                  />
                </Form.Item>
                <Form.Item
                  label="任务描述"
                  name="description"
                  rules={[{ max: 10_000, message: "任务描述不能超过 10000 个字符" }]}
                >
                  <Input.TextArea
                    aria-label="任务描述"
                    disabled={updateMutation.isPending}
                    maxLength={10_000}
                    rows={5}
                  />
                </Form.Item>
                <Form.Item
                  label="优先级"
                  name="priority"
                  rules={[{ required: true, message: "请选择优先级" }]}
                >
                  <Select
                    aria-label="优先级"
                    disabled={updateMutation.isPending}
                    options={workTaskPriorityOptions}
                  />
                </Form.Item>
                <Form.Item label="到期时间（可选）" name="dueTime">
                  <Input
                    aria-label="到期时间"
                    disabled={updateMutation.isPending}
                    type="datetime-local"
                  />
                </Form.Item>
                <Space>
                  <Button
                    disabled={updateMutation.isPending}
                    onClick={() => navigate(`/work/tasks/${taskId}`)}
                  >
                    取消
                  </Button>
                  <Button htmlType="submit" loading={updateMutation.isPending} type="primary">
                    保存任务
                  </Button>
                </Space>
              </Form>
            </Card>
          </main>
        </RouteAuthority>
      </RouteAuthority>
    </RouteAuthority>
  );
}
