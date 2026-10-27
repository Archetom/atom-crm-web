import { ArrowLeftOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Card, Descriptions, List, Space, Spin, Tag, Typography } from "antd";
import { useNavigate, useParams } from "react-router";

import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";

import { StageWorkflowManagementCard } from "../components/stage-workflow-management-card";
import { stageWorkflowKeys } from "../model/query-keys";

import styles from "./stage-workflow-detail-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

export function StageWorkflowDetailPage() {
  const { workflowId: workflowIdParam } = useParams();
  const workflowId = parseRouteId(workflowIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const identityKey = authState?.identityKey ?? "pending";
  const canReadWorkflows = hasAuthority(authorization, authority.workflowsRead);
  const workflowQuery = useQuery({
    queryKey: stageWorkflowKeys.detail(identityKey, workflowId ?? 0),
    queryFn: () =>
      apiClient === null || workflowId === null
        ? Promise.reject(new Error("阶段工作流详情暂时不可用。"))
        : apiClient.getStageWorkflow(workflowId),
    enabled: apiClient !== null && workflowId !== null && canReadWorkflows,
  });

  if (workflowId === null) return <StatusPage kind="not-found" />;
  if (workflowQuery.isLoading) {
    return (
      <div
        aria-label="正在加载阶段工作流详情"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }
  if (workflowQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(workflowQuery.error)}
        onRetry={() => void workflowQuery.refetch()}
      />
    );
  }
  const workflow = workflowQuery.data;
  if (workflow === undefined) return <StatusPage kind="unavailable" />;

  return (
    <RouteAuthority authority={authority.workflowsRead}>
      <main className={styles.page}>
        <section className={styles.heading}>
          <Typography.Link onClick={() => navigate("/workflows")}>
            <ArrowLeftOutlined /> 返回阶段工作流
          </Typography.Link>
          <Typography.Title level={2}>{workflow.name}</Typography.Title>
        </section>
        <Card>
          <Descriptions column={{ md: 2, xs: 1 }} size="small" title="基础配置">
            <Descriptions.Item label="业务对象">{workflow.objectType}</Descriptions.Item>
            <Descriptions.Item label="成功结果名称">{workflow.successName}</Descriptions.Item>
            <Descriptions.Item label="失败结果名称">{workflow.failureName}</Descriptions.Item>
          </Descriptions>
        </Card>
        <StageWorkflowManagementCard
          workflowId={workflow.id}
          onRefresh={() => void workflowQuery.refetch()}
        />
        <section>
          <Typography.Title level={4}>阶段定义</Typography.Title>
          <List
            dataSource={[...workflow.stages].sort((left, right) => left.order - right.order)}
            locale={{ emptyText: "服务端未返回可展示阶段" }}
            renderItem={(stage) => (
              <List.Item>
                <Card
                  className={styles.stageCard}
                  size="small"
                  title={`第 ${stage.order} 阶段：${stage.name}`}
                >
                  <Space wrap>
                    <Tag>概率 {stage.probability}</Tag>
                    {stage.hasApprovalGate ? <Tag color="processing">含审批门</Tag> : null}
                  </Space>
                  <Typography.Paragraph style={{ marginBottom: 0, marginTop: 12 }} type="secondary">
                    必填字段：
                    {stage.requiredFieldCodes.length === 0
                      ? "无"
                      : stage.requiredFieldCodes.join("、")}
                  </Typography.Paragraph>
                  <List
                    className={styles.taskList}
                    dataSource={stage.tasks}
                    locale={{ emptyText: "无阶段任务" }}
                    size="small"
                    renderItem={(task) => (
                      <List.Item>
                        <Typography.Text>{task.name}</Typography.Text>
                        <Tag color={task.required ? "processing" : "default"}>
                          {task.required ? "必填" : "可选"}
                        </Tag>
                      </List.Item>
                    )}
                  />
                </Card>
              </List.Item>
            )}
          />
        </section>
      </main>
    </RouteAuthority>
  );
}
