import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Popconfirm, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

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

import { workTaskSeriesKeys } from "../model/series-query-keys";
import { WorkTaskSeriesOccurrencesModal } from "../components/work-task-series-occurrences-modal";
import {
  formatWorkTaskSeriesRule,
  toWorkTaskSeriesListItem,
  type WorkTaskSeriesAction,
  type WorkTaskSeriesListItem,
} from "../model/work-task-series-list-item";
import { WorkTaskSeriesRemindersModal } from "../components/work-task-reminders-modal";

import styles from "./work-task-series-list-page.module.css";

function updateSearch(current: URLSearchParams, page: number, size: number): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set("page", String(page));
  next.set("size", String(size));
  return next;
}

const seriesColumns: ColumnsType<WorkTaskSeriesListItem> = [
  { dataIndex: "title", key: "title", title: "周期任务" },
  {
    key: "rule",
    title: "周期规则",
    render: (_, series) => formatWorkTaskSeriesRule(series),
  },
  {
    dataIndex: "status",
    key: "status",
    title: "状态",
    render: (value: WorkTaskSeriesListItem["status"]) => <Tag>{value}</Tag>,
  },
];

export function WorkTaskSeriesListPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [occurrenceSeries, setOccurrenceSeries] = useState<WorkTaskSeriesListItem | null>(null);
  const [reminderSeries, setReminderSeries] = useState<WorkTaskSeriesListItem | null>(null);
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
  const deleteMutation = useMutation({
    mutationFn: ({ seriesId, version }: { seriesId: number; version: number }) =>
      apiClient === null
        ? Promise.reject(new Error("停止周期任务暂时不可用。"))
        : apiClient.deleteWorkTaskSeries(seriesId, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workTaskSeriesKeys.lists(identityKey) });
    },
  });
  const pauseMutation = useMutation({
    mutationFn: ({ seriesId, version }: { seriesId: number; version: number }) =>
      apiClient === null
        ? Promise.reject(new Error("暂停周期任务暂时不可用。"))
        : apiClient.pauseWorkTaskSeries(seriesId, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workTaskSeriesKeys.lists(identityKey) });
    },
  });
  const activateMutation = useMutation({
    mutationFn: ({ seriesId, version }: { seriesId: number; version: number }) =>
      apiClient === null
        ? Promise.reject(new Error("恢复周期任务暂时不可用。"))
        : apiClient.activateWorkTaskSeries(seriesId, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workTaskSeriesKeys.lists(identityKey) });
    },
  });
  const seriesQuery = useQuery({
    queryKey: workTaskSeriesKeys.list(identityKey, { page: request.page, size: request.size }),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("周期任务暂时不可用。"))
        : apiClient.getWorkTaskSeries(request),
    enabled: apiClient !== null && canReadWorkTasks,
  });
  const page: PageResult<WorkTaskSeriesListItem> = seriesQuery.data
    ? toPageResult(seriesQuery.data, toWorkTaskSeriesListItem)
    : { ...defaultPageRequest, items: [], meta: {}, total: null };

  function permits(series: WorkTaskSeriesListItem, action: WorkTaskSeriesAction): boolean {
    return series.allowedActions.includes(action);
  }

  function stopFutureAction(series: WorkTaskSeriesListItem) {
    if (!permits(series, "STOP")) return null;

    return (
      <Popconfirm
        cancelText="取消"
        description="停止后不再生成未来任务；已生成的任务和历史发生事实不会被删除。页面只提交当前 version，服务端会重新核验资源动作资格与并发。"
        okButtonProps={{ danger: true }}
        okText="确认停止"
        title="确认停止未来周期任务吗？"
        onConfirm={() => deleteMutation.mutate({ seriesId: series.id, version: series.version })}
      >
        <Button
          danger
          disabled={deleteMutation.isPending}
          loading={deleteMutation.isPending && deleteMutation.variables?.seriesId === series.id}
          size="small"
        >
          停止未来任务
        </Button>
      </Popconfirm>
    );
  }

  function manageFutureRemindersAction(series: WorkTaskSeriesListItem) {
    return permits(series, "UPDATE") ? (
      <Button size="small" onClick={() => setReminderSeries(series)}>
        管理未来提醒
      </Button>
    ) : null;
  }

  function pauseAction(series: WorkTaskSeriesListItem) {
    if (!permits(series, "PAUSE")) return null;

    return (
      <Popconfirm
        cancelText="取消"
        description="暂停后不再生成后续任务；已生成任务和历史发生事实会保留。页面只提交当前 version，服务端会重新核验资源动作资格、状态与并发。"
        okText="确认暂停"
        title="确认暂停周期任务吗？"
        onConfirm={() => pauseMutation.mutate({ seriesId: series.id, version: series.version })}
      >
        <Button
          disabled={pauseMutation.isPending}
          loading={pauseMutation.isPending && pauseMutation.variables?.seriesId === series.id}
          size="small"
        >
          暂停周期任务
        </Button>
      </Popconfirm>
    );
  }

  function activateAction(series: WorkTaskSeriesListItem) {
    if (!permits(series, "ACTIVATE")) return null;

    return (
      <Popconfirm
        cancelText="取消"
        description="恢复会提交当前 version；只有服务端确认调度器、参与人和周期规则均就绪时才会激活。"
        okText="确认恢复"
        title="确认恢复周期任务吗？"
        onConfirm={() => activateMutation.mutate({ seriesId: series.id, version: series.version })}
      >
        <Button
          disabled={activateMutation.isPending}
          loading={activateMutation.isPending && activateMutation.variables?.seriesId === series.id}
          size="small"
        >
          恢复周期任务
        </Button>
      </Popconfirm>
    );
  }

  function editAction(series: WorkTaskSeriesListItem) {
    return permits(series, "UPDATE") ? (
      <Button size="small" onClick={() => navigate(`/work/task-series/${series.id}/edit`)}>
        编辑周期任务
      </Button>
    ) : null;
  }

  function viewOccurrencesAction(series: WorkTaskSeriesListItem) {
    return (
      <ActionAuthority authority={authority.workTasksRead}>
        <Button size="small" onClick={() => setOccurrenceSeries(series)}>
          查看实例
        </Button>
      </ActionAuthority>
    );
  }

  function managementActions(series: WorkTaskSeriesListItem) {
    return (
      <Space wrap>
        {viewOccurrencesAction(series)}
        {editAction(series)}
        {manageFutureRemindersAction(series)}
        {pauseAction(series)}
        {activateAction(series)}
        {stopFutureAction(series)}
      </Space>
    );
  }

  const columns: ColumnsType<WorkTaskSeriesListItem> = [
    ...seriesColumns,
    {
      key: "actions",
      render: (_value, series) => managementActions(series),
      title: "操作",
    },
  ];

  return (
    <RouteAuthority authority={authority.workTasksRead}>
      <main className={styles.page}>
        <section className={styles.heading}>
          <Typography.Title level={2}>周期任务</Typography.Title>
          <Typography.Text type="secondary">
            仅显示服务端确认当前成员可见周期任务的标题、规则与状态；成员、描述、自动化游标、实例计数、失败原因和生命周期时间不进入页面或缓存。停止未来任务只向管理者显示，且只提交当前
            version。编辑、未来提醒、暂停、恢复和停止仅在同一系列的服务端 allowedActions
            明确下发后才显示；恢复仍由服务端复核调度就绪状态。实例仅显示服务端发生事实；未来提醒模板另从专用基线读取并提交该基线
            version，所有操作仍由服务端重新裁决资格与并发。
          </Typography.Text>
          <Space wrap>
            <Button onClick={() => navigate("/work/tasks")}>返回 Work 任务</Button>
            <ActionAuthority authority={authority.workTasksWrite}>
              <ActionAuthority authority={authority.organizationRead}>
                <Button type="primary" onClick={() => navigate("/work/task-series/new")}>
                  新建周期任务
                </Button>
              </ActionAuthority>
            </ActionAuthority>
          </Space>
        </section>
        {seriesQuery.isError ? (
          <Alert
            title={
              seriesQuery.error instanceof ApiError
                ? seriesQuery.error.message
                : "周期任务暂时无法加载"
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
                : "周期任务暂时无法停止"
            }
            showIcon
            type="error"
          />
        ) : null}
        {pauseMutation.isError ? (
          <Alert
            title={
              pauseMutation.error instanceof ApiError
                ? pauseMutation.error.message
                : "周期任务暂时无法暂停"
            }
            showIcon
            type="error"
          />
        ) : null}
        {activateMutation.isError ? (
          <Alert
            title={
              activateMutation.error instanceof ApiError
                ? activateMutation.error.message
                : "周期任务暂时无法恢复"
            }
            showIcon
            type="error"
          />
        ) : null}
        <ResponsiveDataList
          columns={columns}
          loading={seriesQuery.isLoading}
          page={page}
          rowKey={(series) => series.id}
          renderMobileItem={(series) => (
            <Card className={styles.mobileCard} size="small" title={series.title}>
              <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                <Typography.Text>{formatWorkTaskSeriesRule(series)}</Typography.Text>
                <Tag>{series.status}</Tag>
                {managementActions(series)}
              </Space>
            </Card>
          )}
          onPageChange={(nextPage, nextSize) =>
            setSearchParams(updateSearch(searchParams, nextPage, nextSize))
          }
        />
        {occurrenceSeries !== null ? (
          <WorkTaskSeriesOccurrencesModal
            open
            seriesId={occurrenceSeries.id}
            onClose={() => setOccurrenceSeries(null)}
          />
        ) : null}
        {reminderSeries !== null ? (
          <WorkTaskSeriesRemindersModal
            canManage
            open
            seriesId={reminderSeries.id}
            onClose={() => setReminderSeries(null)}
          />
        ) : null}
      </main>
    </RouteAuthority>
  );
}
