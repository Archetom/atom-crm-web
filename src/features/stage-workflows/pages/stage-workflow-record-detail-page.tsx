import { ArrowLeftOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Descriptions, List, Spin, Tag, Typography } from "antd";
import { useNavigate, useParams } from "react-router";

import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";

import { StageWorkflowAdvanceCard } from "../components/stage-workflow-advance-card";
import { StageWorkflowCommentsCard } from "../components/stage-workflow-comments-card";
import { StageWorkflowOutcomeCard } from "../components/stage-workflow-outcome-card";
import { stageWorkflowRuntimeKeys } from "../model/stage-workflow-runtime-query-keys";
import { type StageWorkflowRecordStatus } from "../model/stage-workflow-runtime";

import styles from "./stage-workflow-record-detail-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

const statusLabels: Readonly<Record<StageWorkflowRecordStatus, string>> = {
  ACTIVE: "进行中",
  AWAITING_APPROVAL: "等待审批",
  FAILED: "未完成",
  SUCCEEDED: "已完成",
};

/** Shows a server-authorized running-record summary and its separately capability-gated comments. */
export function StageWorkflowRecordDetailPage() {
  const { workflowRecordId: workflowRecordIdParam } = useParams();
  const workflowRecordId = parseRouteId(workflowRecordIdParam);
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const identityKey = authState?.identityKey ?? "pending";
  const recordQuery = useQuery({
    queryKey: stageWorkflowRuntimeKeys.detail(identityKey, workflowRecordId ?? 0),
    queryFn: () =>
      apiClient === null || workflowRecordId === null
        ? Promise.reject(new Error("阶段工作流运行记录暂时不可用。"))
        : apiClient.getStageWorkflowRecord(workflowRecordId),
    enabled: apiClient !== null && workflowRecordId !== null,
  });

  if (workflowRecordId === null) return <StatusPage kind="not-found" />;
  if (recordQuery.isLoading) {
    return (
      <div
        aria-label="正在加载阶段工作流运行记录"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }
  if (recordQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(recordQuery.error)}
        onRetry={() => void recordQuery.refetch()}
      />
    );
  }
  const record = recordQuery.data;
  if (record === undefined) return <StatusPage kind="unavailable" />;

  return (
    <RouteAuthority authority={authority.workflowsRead}>
      <main className={styles.page}>
        <section className={styles.heading}>
          <Button icon={<ArrowLeftOutlined />} type="link" onClick={() => navigate(-1)}>
            返回上一页
          </Button>
          <Typography.Title level={2}>阶段工作流运行记录</Typography.Title>
          <Typography.Text type="secondary">
            仅展示当前成员可见的服务端状态与当前阶段摘要；操作只在服务端 capability 与完整写入基线
            同时存在时开放。
          </Typography.Text>
        </section>
        <Card title="当前状态">
          <Descriptions
            column={{ xs: 1, sm: 2 }}
            items={[
              {
                children: (
                  <Tag color={record.status === "ACTIVE" ? "processing" : undefined}>
                    {statusLabels[record.status]}
                  </Tag>
                ),
                key: "status",
                label: "流程状态",
              },
              {
                children:
                  record.currentStage === null
                    ? "—"
                    : `第 ${record.currentStage.order} 阶段：${record.currentStage.name}`,
                key: "stage",
                label: "当前阶段",
              },
              {
                children: record.hasApprovalGate ? "当前阶段含服务端审批门" : "当前阶段无需审批门",
                key: "approval-gate",
                label: "审批门",
              },
            ]}
          />
        </Card>
        <Card title="当前阶段任务">
          {record.currentStage === null ? (
            <Alert title="当前没有可展示的阶段任务。" showIcon type="info" />
          ) : (
            <List
              className={styles.taskList}
              dataSource={record.currentStage.tasks}
              locale={{ emptyText: "当前阶段没有服务端可展示的任务。" }}
              renderItem={(task) => (
                <List.Item>
                  <List.Item.Meta
                    description={task.required ? "必填任务" : "可选任务"}
                    title={task.name}
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
        {record.hasUnsupportedAdvanceFields ? (
          <Alert
            title="当前阶段包含需要专门输入流程的字段，暂不能在此页面推进。"
            showIcon
            type="info"
          />
        ) : null}
        {(record.canAdvanceWithFields ||
          record.canAdvanceWithoutInput ||
          record.canAdvanceWithSelections ||
          record.canAdvanceWithTasks) &&
        record.version !== null ? (
          <StageWorkflowAdvanceCard
            addressFields={record.advanceAddressFields}
            candidateFields={record.advanceCandidateFields}
            fields={record.advanceFields}
            fileFields={record.advanceFileFields}
            key={`${record.id}:${record.version}`}
            selections={record.advanceSelections}
            tasks={record.advanceTasks}
            version={record.version}
            workflowRecordId={record.id}
            onRefresh={() => void recordQuery.refetch()}
          />
        ) : null}
        {record.canFail && record.version !== null ? (
          <StageWorkflowOutcomeCard
            key={`${record.id}:${record.version}:outcome`}
            outcomes={record.outcomes}
            version={record.version}
            workflowRecordId={record.id}
            onRefresh={() => void recordQuery.refetch()}
          />
        ) : null}
        <StageWorkflowCommentsCard canComment={record.canComment} workflowRecordId={record.id} />
      </main>
    </RouteAuthority>
  );
}
