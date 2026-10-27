import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { normalizePageRequest, type PageResult } from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";

import { StageWorkflowConfigurationModal } from "../components/stage-workflow-configuration-modal";
import { stageWorkflowKeys } from "../model/query-keys";
import { type StageWorkflowSummary } from "../model/stage-workflow-summary";

import styles from "./stage-workflow-list-page.module.css";

const columns: ColumnsType<StageWorkflowSummary> = [
  {
    dataIndex: "name",
    key: "name",
    title: "流程名称",
    render: (value: string, workflow) => <Link to={`/workflows/${workflow.id}`}>{value}</Link>,
  },
  {
    dataIndex: "objectType",
    key: "objectType",
    title: "业务对象",
    render: (value: string) => <Tag>{value}</Tag>,
  },
];

function updateSearch(current: URLSearchParams, page: number, size: number): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set("page", String(page));
  next.set("size", String(size));
  return next;
}

/** Lists only the safe definition-directory projection returned for the current member. */
export function StageWorkflowListPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const search = searchParams.toString();
  const request = useMemo(() => {
    const params = new URLSearchParams(search);
    return normalizePageRequest({
      page: Number.parseInt(params.get("page") ?? "", 10),
      size: Number.parseInt(params.get("size") ?? "", 10),
    });
  }, [search]);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadWorkflows = hasAuthority(authorization, authority.workflowsRead);
  const canManageWorkflows = hasAuthority(authorization, authority.workflowsManage);
  const workflowQuery = useQuery({
    queryKey: stageWorkflowKeys.list(identityKey, request),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("阶段工作流暂时不可用。"))
        : apiClient.getStageWorkflows(request),
    enabled: apiClient !== null && canReadWorkflows,
  });
  const page: PageResult<StageWorkflowSummary> = {
    ...request,
    items: workflowQuery.data?.items ?? [],
    meta: {},
    total: workflowQuery.data?.total ?? null,
  };

  return (
    <RouteAuthority authority={authority.workflowsRead}>
      <main className={styles.page}>
        <section className={styles.heading}>
          <Typography.Title level={2}>阶段工作流</Typography.Title>
          <Typography.Text type="secondary">
            仅显示服务端授权的流程名称与业务对象。阶段、任务、适用成员或部门、条件、状态、资源级操作资格和时间信息均不进入页面或缓存。
          </Typography.Text>
          {canManageWorkflows ? (
            <Button onClick={() => setCreateOpen(true)}>新建停用流程</Button>
          ) : null}
        </section>
        {workflowQuery.isError ? (
          <Alert
            title={
              workflowQuery.error instanceof ApiError
                ? workflowQuery.error.message
                : "阶段工作流暂时无法加载"
            }
            showIcon
            type="error"
          />
        ) : null}
        <ResponsiveDataList
          columns={columns}
          loading={workflowQuery.isLoading}
          page={page}
          rowKey={(workflow) => workflow.id}
          renderMobileItem={(workflow) => (
            <Card
              className={styles.mobileCard}
              size="small"
              title={<Link to={`/workflows/${workflow.id}`}>{workflow.name}</Link>}
            >
              <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                <Typography.Text>{`业务对象：${workflow.objectType}`}</Typography.Text>
              </Space>
            </Card>
          )}
          onPageChange={(page, size) => setSearchParams(updateSearch(searchParams, page, size))}
        />
        <StageWorkflowConfigurationModal
          mode="create"
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={(workflowId) => navigate(`/workflows/${workflowId}`)}
        />
      </main>
    </RouteAuthority>
  );
}
