import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { getMutationConflict } from "~/api/errors/mutation-conflict";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  defaultPageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";
import {
  MutationConflictNotice,
  type MutationConflictResolution,
} from "~/components/feedback/mutation-conflict-notice";
import { PageHeader } from "~/components/page/page-header";

import {
  toOpportunityPipelineCatalogItem,
  toOpportunityPipelineStageCatalogItem,
  type OpportunityPipelineCatalogItem,
  type OpportunityPipelineCatalogStatus,
  type OpportunityPipelineStageCatalogItem,
} from "../model/opportunity-pipeline-catalog";
import { opportunityKeys } from "../model/query-keys";

import styles from "./opportunity-pipeline-management-page.module.css";

interface PipelineFormValues {
  code?: string;
  name?: string;
  displayOrder?: number;
}

interface StageFormValues extends PipelineFormValues {
  probability?: number;
}

function statusLabel(status: OpportunityPipelineCatalogStatus): string {
  if (status === "ACTIVE") return "启用";
  if (status === "INACTIVE") return "停用";
  return "已删除";
}

function statusColor(status: OpportunityPipelineCatalogStatus): string | undefined {
  if (status === "ACTIVE") return "green";
  if (status === "INACTIVE") return "default";
  return "red";
}

function cleanText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function asCatalogCode(value: string | undefined): string | null {
  const code = cleanText(value);
  return code !== null && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(code) ? code : null;
}

function formInteger(value: number | undefined, maximum: number): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum
    ? value
    : null;
}

function errorMessage(error: Error | undefined): string | undefined {
  if (error === undefined) return undefined;
  return error instanceof ApiError ? error.message : "销售管线目录操作暂时无法完成，请稍后重试。";
}

export function OpportunityPipelineManagementPage() {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [pipelineCreateOpen, setPipelineCreateOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<OpportunityPipelineCatalogItem | null>(
    null,
  );
  const [stageCreateOpen, setStageCreateOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<OpportunityPipelineStageCatalogItem | null>(
    null,
  );
  const [pipelineCreateForm] = Form.useForm<PipelineFormValues>();
  const [pipelineEditForm] = Form.useForm<PipelineFormValues>();
  const [stageCreateForm] = Form.useForm<StageFormValues>();
  const [stageEditForm] = Form.useForm<StageFormValues>();
  const identityKey = authState?.identityKey ?? "pending";
  const pipelineQueryKey = opportunityKeys.pipelineCatalog(identityKey);
  const pipelinesQuery = useQuery({
    queryKey: pipelineQueryKey,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity pipeline API is unavailable."))
        : apiClient.queryOpportunityPipelineCatalog({ page: 1, size: 100 }),
    enabled: apiClient !== null,
  });
  const pipelines: PageResult<OpportunityPipelineCatalogItem> = pipelinesQuery.data
    ? toPageResult(pipelinesQuery.data, toOpportunityPipelineCatalogItem)
    : { ...defaultPageRequest, items: [], total: null, meta: {} };
  const selectedPipeline = useMemo(
    () =>
      selectedPipelineId === null
        ? null
        : (pipelines.items.find((pipeline) => pipeline.id === selectedPipelineId) ?? null),
    [pipelines.items, selectedPipelineId],
  );
  const stagesQuery = useQuery({
    queryKey:
      selectedPipeline === null
        ? [...pipelineQueryKey, "no-pipeline"]
        : opportunityKeys.pipelineStagesCatalog(identityKey, selectedPipeline.id),
    queryFn: () =>
      apiClient === null || selectedPipeline === null
        ? Promise.reject(new Error("Opportunity pipeline stage API is unavailable."))
        : apiClient.queryOpportunityPipelineStagesCatalog(selectedPipeline.id, {
            page: 1,
            size: 100,
          }),
    enabled: apiClient !== null && selectedPipeline !== null,
  });
  const stages: PageResult<OpportunityPipelineStageCatalogItem> = stagesQuery.data
    ? toPageResult(stagesQuery.data, toOpportunityPipelineStageCatalogItem)
    : { ...defaultPageRequest, items: [], total: null, meta: {} };
  const refreshCatalog = () =>
    queryClient.invalidateQueries({ queryKey: opportunityKeys.pipelineCatalog(identityKey) });
  const createPipelineMutation = useMutation({
    mutationFn: (request: Required<PipelineFormValues>) =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity pipeline create API is unavailable."))
        : apiClient.createOpportunityPipeline(request),
    onSuccess: (pipeline) => {
      void refreshCatalog();
      setSelectedPipelineId(pipeline.id);
      closePipelineCreate(true);
    },
  });
  const updatePipelineMutation = useMutation({
    mutationFn: ({
      pipeline,
      request,
    }: {
      pipeline: OpportunityPipelineCatalogItem;
      request: { displayOrder: number; name: string; version: number };
    }) =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity pipeline update API is unavailable."))
        : apiClient.updateOpportunityPipeline(pipeline.id, request),
    onSuccess: () => {
      void refreshCatalog();
      closePipelineEdit(true);
    },
  });
  const pipelineStatusMutation = useMutation({
    mutationFn: ({
      pipeline,
      status,
    }: {
      pipeline: OpportunityPipelineCatalogItem;
      status: "ACTIVE" | "INACTIVE";
    }) =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity pipeline status API is unavailable."))
        : apiClient.updateOpportunityPipelineStatus(pipeline.id, {
            status,
            version: pipeline.version,
          }),
    onSuccess: () => {
      void refreshCatalog();
    },
  });
  const deletePipelineMutation = useMutation({
    mutationFn: (pipeline: OpportunityPipelineCatalogItem) =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity pipeline delete API is unavailable."))
        : apiClient.deleteOpportunityPipeline(pipeline.id, pipeline.version),
    onSuccess: () => {
      void refreshCatalog();
    },
  });
  const createStageMutation = useMutation({
    mutationFn: ({
      pipeline,
      request,
    }: {
      pipeline: OpportunityPipelineCatalogItem;
      request: Required<StageFormValues>;
    }) =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity pipeline stage create API is unavailable."))
        : apiClient.createOpportunityPipelineStage(pipeline.id, request),
    onSuccess: () => {
      void refreshCatalog();
      closeStageCreate(true);
    },
  });
  const updateStageMutation = useMutation({
    mutationFn: ({
      pipeline,
      stage,
      request,
    }: {
      pipeline: OpportunityPipelineCatalogItem;
      stage: OpportunityPipelineStageCatalogItem;
      request: { displayOrder: number; name: string; probability: number; version: number };
    }) =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity pipeline stage update API is unavailable."))
        : apiClient.updateOpportunityPipelineStage(pipeline.id, stage.id, request),
    onSuccess: () => {
      void refreshCatalog();
      closeStageEdit(true);
    },
  });
  const stageStatusMutation = useMutation({
    mutationFn: ({
      pipeline,
      stage,
      status,
    }: {
      pipeline: OpportunityPipelineCatalogItem;
      stage: OpportunityPipelineStageCatalogItem;
      status: "ACTIVE" | "INACTIVE";
    }) =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity pipeline stage status API is unavailable."))
        : apiClient.updateOpportunityPipelineStageStatus(pipeline.id, stage.id, {
            status,
            version: stage.version,
          }),
    onSuccess: () => {
      void refreshCatalog();
    },
  });
  const deleteStageMutation = useMutation({
    mutationFn: ({
      pipeline,
      stage,
    }: {
      pipeline: OpportunityPipelineCatalogItem;
      stage: OpportunityPipelineStageCatalogItem;
    }) =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity pipeline stage delete API is unavailable."))
        : apiClient.deleteOpportunityPipelineStage(pipeline.id, stage.id, stage.version),
    onSuccess: () => {
      void refreshCatalog();
    },
  });
  const activeMutationError = [
    createPipelineMutation.error,
    updatePipelineMutation.error,
    pipelineStatusMutation.error,
    deletePipelineMutation.error,
    createStageMutation.error,
    updateStageMutation.error,
    stageStatusMutation.error,
    deleteStageMutation.error,
  ].find((error): error is Error => error instanceof Error);
  const mutationConflict = getMutationConflict(activeMutationError);

  function resetMutations() {
    createPipelineMutation.reset();
    updatePipelineMutation.reset();
    pipelineStatusMutation.reset();
    deletePipelineMutation.reset();
    createStageMutation.reset();
    updateStageMutation.reset();
    stageStatusMutation.reset();
    deleteStageMutation.reset();
  }

  function closePipelineCreate(force = false) {
    if (!force && createPipelineMutation.isPending) return;
    createPipelineMutation.reset();
    pipelineCreateForm.resetFields();
    setPipelineCreateOpen(false);
  }

  function closePipelineEdit(force = false) {
    if (!force && updatePipelineMutation.isPending) return;
    updatePipelineMutation.reset();
    pipelineEditForm.resetFields();
    setEditingPipeline(null);
  }

  function closeStageCreate(force = false) {
    if (!force && createStageMutation.isPending) return;
    createStageMutation.reset();
    stageCreateForm.resetFields();
    setStageCreateOpen(false);
  }

  function closeStageEdit(force = false) {
    if (!force && updateStageMutation.isPending) return;
    updateStageMutation.reset();
    stageEditForm.resetFields();
    setEditingStage(null);
  }

  function openPipelineCreate() {
    resetMutations();
    pipelineCreateForm.setFieldsValue({ displayOrder: pipelines.items.length });
    setPipelineCreateOpen(true);
  }

  function openPipelineEdit(pipeline: OpportunityPipelineCatalogItem) {
    resetMutations();
    pipelineEditForm.setFieldsValue({
      code: pipeline.code,
      displayOrder: pipeline.displayOrder,
      name: pipeline.name,
    });
    setEditingPipeline(pipeline);
  }

  function openStageCreate() {
    if (selectedPipeline === null) return;
    resetMutations();
    stageCreateForm.setFieldsValue({ displayOrder: stages.items.length, probability: 0 });
    setStageCreateOpen(true);
  }

  function openStageEdit(stage: OpportunityPipelineStageCatalogItem) {
    resetMutations();
    stageEditForm.setFieldsValue({
      code: stage.code,
      displayOrder: stage.displayOrder,
      name: stage.name,
      probability: stage.probability,
    });
    setEditingStage(stage);
  }

  function submitPipelineCreate(values: PipelineFormValues) {
    const code = asCatalogCode(values.code);
    const name = cleanText(values.name);
    const displayOrder = formInteger(values.displayOrder, 1_000_000);
    if (code === null || name === null || displayOrder === null) return;
    createPipelineMutation.mutate({ code, displayOrder, name });
  }

  function submitPipelineEdit(values: PipelineFormValues) {
    const name = cleanText(values.name);
    const displayOrder = formInteger(values.displayOrder, 1_000_000);
    if (editingPipeline === null || name === null || displayOrder === null) return;
    updatePipelineMutation.mutate({
      pipeline: editingPipeline,
      request: { displayOrder, name, version: editingPipeline.version },
    });
  }

  function submitStageCreate(values: StageFormValues) {
    const code = asCatalogCode(values.code);
    const name = cleanText(values.name);
    const displayOrder = formInteger(values.displayOrder, 1_000_000);
    const probability = formInteger(values.probability, 100);
    if (
      selectedPipeline === null ||
      code === null ||
      name === null ||
      displayOrder === null ||
      probability === null
    ) {
      return;
    }
    createStageMutation.mutate({
      pipeline: selectedPipeline,
      request: { code, displayOrder, name, probability },
    });
  }

  function submitStageEdit(values: StageFormValues) {
    const name = cleanText(values.name);
    const displayOrder = formInteger(values.displayOrder, 1_000_000);
    const probability = formInteger(values.probability, 100);
    if (
      selectedPipeline === null ||
      editingStage === null ||
      name === null ||
      displayOrder === null ||
      probability === null
    ) {
      return;
    }
    updateStageMutation.mutate({
      pipeline: selectedPipeline,
      request: { displayOrder, name, probability, version: editingStage.version },
      stage: editingStage,
    });
  }

  async function resolveConflict(resolution: MutationConflictResolution) {
    if (resolution === "dismiss") {
      resetMutations();
      return;
    }

    const pipelineResult = await pipelinesQuery.refetch();
    const refreshedPipelines = pipelineResult.data
      ? toPageResult(pipelineResult.data, toOpportunityPipelineCatalogItem).items
      : [];
    const refreshedPipeline =
      selectedPipelineId === null
        ? null
        : (refreshedPipelines.find((pipeline) => pipeline.id === selectedPipelineId) ?? null);
    const stageResult = selectedPipeline === null ? null : await stagesQuery.refetch();
    const refreshedStages = stageResult?.data
      ? toPageResult(stageResult.data, toOpportunityPipelineStageCatalogItem).items
      : [];

    if (resolution === "discard-draft-and-reload") {
      closePipelineCreate(true);
      closePipelineEdit(true);
      closeStageCreate(true);
      closeStageEdit(true);
    } else {
      if (editingPipeline !== null) {
        setEditingPipeline(
          refreshedPipelines.find((pipeline) => pipeline.id === editingPipeline.id) ?? null,
        );
      }
      if (editingStage !== null) {
        setEditingStage(
          refreshedPipeline === null
            ? null
            : (refreshedStages.find((stage) => stage.id === editingStage.id) ?? null),
        );
      }
    }
    resetMutations();
  }

  const pipelineColumns: ColumnsType<OpportunityPipelineCatalogItem> = [
    {
      dataIndex: "name",
      key: "name",
      title: "管线名称",
      render: (name: string, pipeline) => (
        <Button
          type={selectedPipelineId === pipeline.id ? "primary" : "link"}
          onClick={() => setSelectedPipelineId(pipeline.id)}
        >
          {name}
        </Button>
      ),
    },
    { dataIndex: "code", key: "code", title: "固定编码" },
    { dataIndex: "displayOrder", key: "displayOrder", title: "排序" },
    {
      dataIndex: "status",
      key: "status",
      title: "状态",
      render: (status: OpportunityPipelineCatalogStatus) => (
        <Tag color={statusColor(status)}>{statusLabel(status)}</Tag>
      ),
    },
    {
      key: "actions",
      title: "操作",
      render: (_, pipeline) => (
        <Space size="small" wrap>
          <Button type="link" onClick={() => setSelectedPipelineId(pipeline.id)}>
            管理阶段
          </Button>
          <ActionAuthority authority={authority.opportunityPipelinesManage}>
            {pipeline.status === "DELETED" ? null : (
              <>
                <Button type="link" onClick={() => openPipelineEdit(pipeline)}>
                  编辑
                </Button>
                <Popconfirm
                  cancelText="取消"
                  description={
                    pipeline.status === "ACTIVE"
                      ? "停用后不能再作为新建或迁入商机的销售管线；服务端会以当前版本再次校验。"
                      : "启用前服务端会确认该管线至少有一个启用阶段，并以当前版本再次校验。"
                  }
                  okText="确认"
                  title={pipeline.status === "ACTIVE" ? "停用销售管线？" : "启用销售管线？"}
                  onConfirm={() =>
                    pipelineStatusMutation.mutate({
                      pipeline,
                      status: pipeline.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                    })
                  }
                >
                  <Button loading={pipelineStatusMutation.isPending} type="link">
                    {pipeline.status === "ACTIVE" ? "停用" : "启用"}
                  </Button>
                </Popconfirm>
                {pipeline.status === "INACTIVE" ? (
                  <Popconfirm
                    cancelText="取消"
                    description="删除不可恢复。服务端仅会在该管线没有任何未删除阶段时执行删除，并以当前版本再次校验。"
                    okButtonProps={{ danger: true }}
                    okText="确认删除"
                    title={`删除销售管线“${pipeline.name}”？`}
                    onConfirm={() => deletePipelineMutation.mutate(pipeline)}
                  >
                    <Button danger loading={deletePipelineMutation.isPending} type="link">
                      删除
                    </Button>
                  </Popconfirm>
                ) : null}
              </>
            )}
          </ActionAuthority>
        </Space>
      ),
    },
  ];
  const stageColumns: ColumnsType<OpportunityPipelineStageCatalogItem> = [
    { dataIndex: "name", key: "name", title: "阶段名称" },
    { dataIndex: "code", key: "code", title: "固定编码" },
    {
      dataIndex: "probability",
      key: "probability",
      title: "赢单概率",
      render: (value) => `${value}%`,
    },
    { dataIndex: "displayOrder", key: "displayOrder", title: "排序" },
    {
      dataIndex: "status",
      key: "status",
      title: "状态",
      render: (status: OpportunityPipelineCatalogStatus) => (
        <Tag color={statusColor(status)}>{statusLabel(status)}</Tag>
      ),
    },
    {
      key: "actions",
      title: "操作",
      render: (_, stage) =>
        selectedPipeline === null ? null : (
          <ActionAuthority authority={authority.opportunityPipelinesManage}>
            {stage.status === "DELETED" || selectedPipeline.status === "DELETED" ? null : (
              <Space size="small" wrap>
                <Button type="link" onClick={() => openStageEdit(stage)}>
                  编辑
                </Button>
                <Popconfirm
                  cancelText="取消"
                  description={
                    stage.status === "ACTIVE"
                      ? "停用前，服务端会确认启用的销售管线仍保留至少一个启用阶段，并以当前版本再次校验。"
                      : "启用阶段后才可用于启用该销售管线；服务端会以当前版本再次校验。"
                  }
                  okText="确认"
                  title={stage.status === "ACTIVE" ? "停用销售阶段？" : "启用销售阶段？"}
                  onConfirm={() =>
                    stageStatusMutation.mutate({
                      pipeline: selectedPipeline,
                      stage,
                      status: stage.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                    })
                  }
                >
                  <Button loading={stageStatusMutation.isPending} type="link">
                    {stage.status === "ACTIVE" ? "停用" : "启用"}
                  </Button>
                </Popconfirm>
                {stage.status === "INACTIVE" ? (
                  <Popconfirm
                    cancelText="取消"
                    description="删除不可恢复。服务端只允许删除停用阶段，并会以当前版本再次校验。"
                    okButtonProps={{ danger: true }}
                    okText="确认删除"
                    title={`删除销售阶段“${stage.name}”？`}
                    onConfirm={() =>
                      deleteStageMutation.mutate({ pipeline: selectedPipeline, stage })
                    }
                  >
                    <Button danger loading={deleteStageMutation.isPending} type="link">
                      删除
                    </Button>
                  </Popconfirm>
                ) : null}
              </Space>
            )}
          </ActionAuthority>
        ),
    },
  ];

  return (
    <RouteAuthority authority={authority.opportunityPipelinesRead}>
      <main className={styles.page}>
        <PageHeader
          description="管线和阶段编码由服务端永久保留；页面只使用服务端返回的版本基线提交显示配置与生命周期操作。"
          title="销售管线管理"
        />
        <section className={styles.actions} aria-label="销售管线管理操作">
          <Button onClick={() => navigate("/crm/opportunities")}>返回商机</Button>
          <ActionAuthority authority={authority.opportunityPipelinesManage}>
            <Button type="primary" onClick={openPipelineCreate}>
              新建销售管线
            </Button>
          </ActionAuthority>
        </section>
        {pipelinesQuery.isError ? (
          <Alert
            title={
              pipelinesQuery.error instanceof ApiError
                ? pipelinesQuery.error.message
                : "销售管线目录暂时无法加载"
            }
            showIcon
            type="error"
          />
        ) : null}
        {activeMutationError !== undefined && mutationConflict === null ? (
          <Alert title={errorMessage(activeMutationError)} showIcon type="error" />
        ) : null}
        {activeMutationError !== undefined ? (
          <MutationConflictNotice
            error={activeMutationError}
            onResolve={(resolution) => void resolveConflict(resolution)}
          />
        ) : null}
        <Card loading={pipelinesQuery.isLoading} title="服务端销售管线目录">
          <Table
            columns={pipelineColumns}
            dataSource={pipelines.items}
            locale={{ emptyText: "暂未返回可见销售管线。" }}
            pagination={false}
            rowKey="id"
            scroll={{ x: 760 }}
            size="middle"
          />
        </Card>
        {selectedPipeline === null ? (
          <Card>
            <Typography.Text type="secondary">请选择一个销售管线以管理其阶段。</Typography.Text>
          </Card>
        ) : (
          <Card
            extra={
              <ActionAuthority authority={authority.opportunityPipelinesManage}>
                <Button
                  disabled={selectedPipeline.status === "DELETED"}
                  type="primary"
                  onClick={openStageCreate}
                >
                  新建销售阶段
                </Button>
              </ActionAuthority>
            }
            loading={stagesQuery.isLoading}
            title={`“${selectedPipeline.name}”的销售阶段`}
          >
            <Descriptions
              className={styles.pipelineDescription}
              column={{ sm: 2, xs: 1 }}
              size="small"
            >
              <Descriptions.Item label="固定编码">{selectedPipeline.code}</Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={statusColor(selectedPipeline.status)}>
                  {statusLabel(selectedPipeline.status)}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
            {stagesQuery.isError ? (
              <Alert
                className={styles.stageError}
                title={
                  stagesQuery.error instanceof ApiError
                    ? stagesQuery.error.message
                    : "销售阶段目录暂时无法加载"
                }
                showIcon
                type="error"
              />
            ) : null}
            <Table
              columns={stageColumns}
              dataSource={stages.items}
              locale={{ emptyText: "暂未返回该销售管线的阶段。" }}
              pagination={false}
              rowKey="id"
              scroll={{ x: 760 }}
              size="middle"
            />
          </Card>
        )}
      </main>
      <Modal
        destroyOnHidden
        footer={null}
        open={pipelineCreateOpen}
        title="新建销售管线"
        onCancel={() => closePipelineCreate()}
      >
        <Typography.Paragraph type="secondary">
          新建管线初始为停用状态。固定编码创建后不可修改；启用前必须先创建并启用至少一个销售阶段。
        </Typography.Paragraph>
        <Form form={pipelineCreateForm} layout="vertical" onFinish={submitPipelineCreate}>
          <Form.Item
            label="固定编码"
            name="code"
            rules={[
              { required: true, whitespace: true, message: "请输入固定编码" },
              {
                pattern: /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/,
                message: "编码仅支持字母、数字、点、下划线和连字符，长度不超过 64",
              },
            ]}
          >
            <Input aria-label="销售管线固定编码" maxLength={64} placeholder="例如 direct" />
          </Form.Item>
          <Form.Item
            label="管线名称"
            name="name"
            rules={[
              { required: true, whitespace: true, message: "请输入管线名称" },
              { max: 200, message: "管线名称不能超过 200 个字符" },
            ]}
          >
            <Input aria-label="销售管线名称" maxLength={200} placeholder="请输入销售管线名称" />
          </Form.Item>
          <Form.Item
            label="排序"
            name="displayOrder"
            rules={[{ required: true, message: "请输入排序值" }]}
          >
            <InputNumber aria-label="销售管线排序" max={1_000_000} min={0} precision={0} />
          </Form.Item>
          <Space>
            <Button onClick={() => closePipelineCreate()}>取消</Button>
            <Button htmlType="submit" loading={createPipelineMutation.isPending} type="primary">
              创建销售管线
            </Button>
          </Space>
        </Form>
      </Modal>
      <Modal
        destroyOnHidden
        footer={null}
        open={editingPipeline !== null}
        title="编辑销售管线"
        onCancel={() => closePipelineEdit()}
      >
        <Typography.Paragraph type="secondary">
          固定编码不可修改。保存只提交当前服务端版本对应的名称和排序，服务端会再次核验生命周期。
        </Typography.Paragraph>
        <Form form={pipelineEditForm} layout="vertical" onFinish={submitPipelineEdit}>
          <Form.Item label="固定编码" name="code">
            <Input aria-label="销售管线固定编码" disabled />
          </Form.Item>
          <Form.Item
            label="管线名称"
            name="name"
            rules={[
              { required: true, whitespace: true, message: "请输入管线名称" },
              { max: 200, message: "管线名称不能超过 200 个字符" },
            ]}
          >
            <Input aria-label="销售管线名称" maxLength={200} />
          </Form.Item>
          <Form.Item
            label="排序"
            name="displayOrder"
            rules={[{ required: true, message: "请输入排序值" }]}
          >
            <InputNumber aria-label="销售管线排序" max={1_000_000} min={0} precision={0} />
          </Form.Item>
          <Space>
            <Button onClick={() => closePipelineEdit()}>取消</Button>
            <Button htmlType="submit" loading={updatePipelineMutation.isPending} type="primary">
              保存管线
            </Button>
          </Space>
        </Form>
      </Modal>
      <Modal
        destroyOnHidden
        footer={null}
        open={stageCreateOpen}
        title="新建销售阶段"
        onCancel={() => closeStageCreate()}
      >
        <Typography.Paragraph type="secondary">
          新建阶段初始为停用状态。固定编码创建后不可修改；概率只表示目录配置，不会改变已有商机结果。
        </Typography.Paragraph>
        <Form form={stageCreateForm} layout="vertical" onFinish={submitStageCreate}>
          <Form.Item
            label="固定编码"
            name="code"
            rules={[
              { required: true, whitespace: true, message: "请输入固定编码" },
              {
                pattern: /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/,
                message: "编码仅支持字母、数字、点、下划线和连字符，长度不超过 64",
              },
            ]}
          >
            <Input aria-label="销售阶段固定编码" maxLength={64} placeholder="例如 qualification" />
          </Form.Item>
          <Form.Item
            label="阶段名称"
            name="name"
            rules={[
              { required: true, whitespace: true, message: "请输入阶段名称" },
              { max: 200, message: "阶段名称不能超过 200 个字符" },
            ]}
          >
            <Input aria-label="销售阶段名称" maxLength={200} placeholder="请输入销售阶段名称" />
          </Form.Item>
          <Form.Item
            label="赢单概率"
            name="probability"
            rules={[{ required: true, message: "请输入赢单概率" }]}
          >
            <InputNumber aria-label="销售阶段赢单概率" max={100} min={0} precision={0} suffix="%" />
          </Form.Item>
          <Form.Item
            label="排序"
            name="displayOrder"
            rules={[{ required: true, message: "请输入排序值" }]}
          >
            <InputNumber aria-label="销售阶段排序" max={1_000_000} min={0} precision={0} />
          </Form.Item>
          <Space>
            <Button onClick={() => closeStageCreate()}>取消</Button>
            <Button htmlType="submit" loading={createStageMutation.isPending} type="primary">
              创建销售阶段
            </Button>
          </Space>
        </Form>
      </Modal>
      <Modal
        destroyOnHidden
        footer={null}
        open={editingStage !== null}
        title="编辑销售阶段"
        onCancel={() => closeStageEdit()}
      >
        <Typography.Paragraph type="secondary">
          固定编码不可修改。保存只提交当前服务端版本对应的名称、概率和排序，服务端会再次核验生命周期。
        </Typography.Paragraph>
        <Form form={stageEditForm} layout="vertical" onFinish={submitStageEdit}>
          <Form.Item label="固定编码" name="code">
            <Input aria-label="销售阶段固定编码" disabled />
          </Form.Item>
          <Form.Item
            label="阶段名称"
            name="name"
            rules={[
              { required: true, whitespace: true, message: "请输入阶段名称" },
              { max: 200, message: "阶段名称不能超过 200 个字符" },
            ]}
          >
            <Input aria-label="销售阶段名称" maxLength={200} />
          </Form.Item>
          <Form.Item
            label="赢单概率"
            name="probability"
            rules={[{ required: true, message: "请输入赢单概率" }]}
          >
            <InputNumber aria-label="销售阶段赢单概率" max={100} min={0} precision={0} suffix="%" />
          </Form.Item>
          <Form.Item
            label="排序"
            name="displayOrder"
            rules={[{ required: true, message: "请输入排序值" }]}
          >
            <InputNumber aria-label="销售阶段排序" max={1_000_000} min={0} precision={0} />
          </Form.Item>
          <Space>
            <Button onClick={() => closeStageEdit()}>取消</Button>
            <Button htmlType="submit" loading={updateStageMutation.isPending} type="primary">
              保存阶段
            </Button>
          </Space>
        </Form>
      </Modal>
    </RouteAuthority>
  );
}
