import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  defaultPageRequest,
  normalizePageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";

import { workTaskKeys } from "../model/query-keys";
import { toWorkTaskListItem, type WorkTaskListItem } from "../model/work-task-list-item";

import styles from "./work-task-list-page.module.css";

function updateSearch(current: URLSearchParams, page: number, size: number): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set("page", String(page));
  next.set("size", String(size));
  return next;
}

const columns: ColumnsType<WorkTaskListItem> = [
  {
    dataIndex: "title",
    key: "title",
    title: "任务标题",
    render: (value: string, task) => <Link to={`/work/tasks/${task.id}`}>{value}</Link>,
  },
  {
    dataIndex: "priority",
    key: "priority",
    title: "优先级",
    render: (value: string | null) => (value === null ? "—" : <Tag>{value}</Tag>),
  },
  {
    dataIndex: "dueTime",
    key: "dueTime",
    title: "到期时间",
    render: (value: string | null) => value ?? "—",
  },
  {
    dataIndex: "status",
    key: "status",
    title: "状态",
    render: (value: string | null) => (value === null ? "—" : <Tag>{value}</Tag>),
  },
];

export function WorkTaskListPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.toString();
  const request = useMemo(() => {
    const params = new URLSearchParams(search);
    return normalizePageRequest({
      page: Number.parseInt(params.get("page") ?? "", 10),
      size: Number.parseInt(params.get("size") ?? "", 10),
    });
  }, [search]);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadWorkTasks = hasAuthority(authorization, authority.workTasksRead);
  const taskQuery = useQuery({
    queryKey: workTaskKeys.list(identityKey, { page: request.page, size: request.size }),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Work 任务暂时不可用。"))
        : apiClient.getWorkTasks(request),
    enabled: apiClient !== null && canReadWorkTasks,
  });
  const page: PageResult<WorkTaskListItem> = taskQuery.data
    ? toPageResult(taskQuery.data, toWorkTaskListItem)
    : { ...defaultPageRequest, items: [], meta: {}, total: null };

  return (
    <RouteAuthority authority={authority.workTasksRead}>
      <main className={styles.page}>
        <section className={styles.heading}>
          <Typography.Title level={2}>Work 任务</Typography.Title>
          <Typography.Text type="secondary">
            仅显示服务端确认当前成员可见任务的标题、优先级、到期时间、状态与逾期标记；描述、参与成员、业务关联、来源、提醒和生命周期记录不进入页面或缓存。
          </Typography.Text>
          <Space wrap>
            <Button onClick={() => navigate("/work/task-series")}>查看周期任务</Button>
            <ActionAuthority authority={authority.workTasksWrite}>
              <ActionAuthority authority={authority.organizationRead}>
                <Button type="primary" onClick={() => navigate("/work/tasks/new")}>
                  新建任务
                </Button>
              </ActionAuthority>
            </ActionAuthority>
          </Space>
        </section>
        {taskQuery.isError ? (
          <Alert
            title={
              taskQuery.error instanceof ApiError
                ? taskQuery.error.message
                : "Work 任务暂时无法加载"
            }
            showIcon
            type="error"
          />
        ) : null}
        <ResponsiveDataList
          columns={columns}
          loading={taskQuery.isLoading}
          page={page}
          rowKey={(task) => task.id}
          renderMobileItem={(task) => (
            <Card
              className={styles.mobileCard}
              size="small"
              title={<Link to={`/work/tasks/${task.id}`}>{task.title}</Link>}
            >
              <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                <Typography.Text>{`优先级：${task.priority ?? "未提供"}`}</Typography.Text>
                <Typography.Text>{`到期时间：${task.dueTime ?? "未提供"}`}</Typography.Text>
                <Typography.Text>{`逾期：${task.overdue ? "是" : "否"}`}</Typography.Text>
                {task.status === null ? null : <Tag>{task.status}</Tag>}
              </Space>
            </Card>
          )}
          onPageChange={(nextPage, nextSize) =>
            setSearchParams(updateSearch(searchParams, nextPage, nextSize))
          }
        />
      </main>
    </RouteAuthority>
  );
}
