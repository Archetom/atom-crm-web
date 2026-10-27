import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Typography,
  type FormInstance,
} from "antd";
import { useEffect, useState } from "react";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import {
  toStageWorkflowConfigurationRequest,
  toStageWorkflowConfigurationValues,
  type StageWorkflowConfigurationCandidate,
  type StageWorkflowConfigurationCandidateType,
  type StageWorkflowConfigurationStage,
  type StageWorkflowConfigurationValues,
  type StageWorkflowObjectType,
} from "../model/stage-workflow-configuration";
import { stageWorkflowKeys } from "../model/query-keys";

interface StageWorkflowConfigurationModalProps {
  mode: "create" | "edit";
  onClose: () => void;
  onSaved: (workflowId: number) => void;
  open: boolean;
  workflowId?: number;
}

interface StageWorkflowConfigurationTaskFormValues {
  code?: string;
  name?: string;
  required?: boolean;
}

interface StageWorkflowConfigurationStageFormValues {
  approvalDefinitionId?: number;
  code?: string;
  name?: string;
  order?: number;
  probability?: number;
  requiredFieldCodes?: string[];
  tasks?: StageWorkflowConfigurationTaskFormValues[];
}

interface StageWorkflowConfigurationFormValues {
  applicableActorIds?: number[];
  applicableDepartmentIds?: number[];
  failureName?: string;
  name?: string;
  objectType?: StageWorkflowObjectType;
  stages?: StageWorkflowConfigurationStageFormValues[];
  successName?: string;
}

interface ScopeCandidateSelectProps {
  candidateType: StageWorkflowConfigurationCandidateType;
  form: FormInstance<StageWorkflowConfigurationFormValues>;
  label: string;
  name: "applicableActorIds" | "applicableDepartmentIds";
  open: boolean;
}

const candidatePageSize = 50;

function positiveIds(value: unknown): number[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (item): item is number =>
              typeof item === "number" && Number.isSafeInteger(item) && item > 0,
          ),
        ),
      ]
    : [];
}

function completePositiveIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return [];
  if (!value.every((item) => typeof item === "number" && Number.isSafeInteger(item) && item > 0)) {
    return null;
  }
  const values = value as number[];
  return new Set(values).size === values.length ? values : null;
}

function candidateOptions(
  selectedIds: readonly number[],
  candidates: readonly StageWorkflowConfigurationCandidate[],
  label: string,
) {
  const options = new Map<number, string>();
  for (const id of selectedIds) options.set(id, `${label} #${id}`);
  for (const candidate of candidates) options.set(candidate.id, candidate.displayName);
  return [...options].map(([value, optionLabel]) => ({ label: optionLabel, value }));
}

/** Selects only the current member/department candidates supplied for workflow configuration. */
function ScopeCandidateSelect({
  candidateType,
  form,
  label,
  name,
  open,
}: Readonly<ScopeCandidateSelectProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const [keyword, setKeyword] = useState("");
  const identityKey = authState?.identityKey ?? "stage-workflow-configuration";
  const canManageWorkflows = hasAuthority(authorization, authority.workflowsManage);
  const selectedIds = positiveIds(Form.useWatch(name, form));
  const candidatesQuery = useQuery({
    queryKey: stageWorkflowKeys.configurationCandidates(identityKey, candidateType, keyword),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("阶段工作流配置候选暂时不可用。"))
        : apiClient.getStageWorkflowConfigurationCandidates(candidateType, {
            keyword: keyword.trim() || undefined,
            page: 1,
            size: candidatePageSize,
          }),
    enabled: open && apiClient !== null && canManageWorkflows,
  });
  const options = candidateOptions(selectedIds, candidatesQuery.data?.candidates ?? [], label);

  return (
    <Form.Item label={label} name={name}>
      <Select
        aria-label={label}
        filterOption={false}
        loading={candidatesQuery.isLoading}
        mode="multiple"
        notFoundContent={candidatesQuery.isLoading ? <Spin size="small" /> : "未找到服务端可选项"}
        options={options}
        placeholder={`从服务端目录选择${label}`}
        showSearch
        onSearch={setKeyword}
      />
      {candidatesQuery.isError ? (
        <Alert title={`${label}暂时无法加载`} showIcon type="error" />
      ) : null}
    </Form.Item>
  );
}

function toFormStages(stages: readonly StageWorkflowConfigurationStage[]) {
  return stages.map((stage) => ({
    approvalDefinitionId: stage.approvalDefinitionId ?? undefined,
    code: stage.code,
    name: stage.name,
    order: stage.order,
    probability: stage.probability,
    requiredFieldCodes: stage.requiredFieldCodes,
    tasks: stage.tasks,
  }));
}

function toConfigurationValues(
  values: StageWorkflowConfigurationFormValues,
): StageWorkflowConfigurationValues | null {
  if (
    values.name === undefined ||
    values.successName === undefined ||
    values.failureName === undefined ||
    values.objectType === undefined ||
    values.stages === undefined
  ) {
    return null;
  }
  const stages: StageWorkflowConfigurationStage[] = [];
  const applicableActorIds = completePositiveIds(values.applicableActorIds);
  const applicableDepartmentIds = completePositiveIds(values.applicableDepartmentIds);
  if (applicableActorIds === null || applicableDepartmentIds === null) return null;
  for (const stage of values.stages) {
    if (
      stage.code === undefined ||
      stage.name === undefined ||
      stage.order === undefined ||
      stage.probability === undefined
    ) {
      return null;
    }
    const tasks = stage.tasks ?? [];
    if (tasks.some((task) => task.code === undefined || task.name === undefined)) return null;
    stages.push({
      approvalDefinitionId: stage.approvalDefinitionId ?? null,
      blockerCode: null,
      code: stage.code,
      editable: true,
      name: stage.name,
      order: stage.order,
      probability: stage.probability,
      requiredFieldCodes: stage.requiredFieldCodes ?? [],
      tasks: tasks.map((task) => ({
        code: task.code ?? "",
        name: task.name ?? "",
        required: task.required === true,
      })),
    });
  }
  return {
    applicableActorIds,
    applicableDepartmentIds,
    failureName: values.failureName,
    name: values.name,
    objectType: values.objectType,
    stages,
    successName: values.successName,
  };
}

/** Creates or safely replaces a complete server-scoped stage-workflow definition. */
export function StageWorkflowConfigurationModal({
  mode,
  onClose,
  onSaved,
  open,
  workflowId,
}: Readonly<StageWorkflowConfigurationModalProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<StageWorkflowConfigurationFormValues>();
  const [formError, setFormError] = useState<string | null>(null);
  const [createObjectType, setCreateObjectType] = useState<StageWorkflowObjectType | null>(null);
  const identityKey = authState?.identityKey ?? "stage-workflow-configuration";
  const canManageWorkflows = hasAuthority(authorization, authority.workflowsManage);
  const editing = mode === "edit";
  const baselineQuery = useQuery({
    queryKey: stageWorkflowKeys.editable(identityKey, workflowId ?? 0),
    queryFn: () =>
      workflowId === undefined || apiClient === null
        ? Promise.reject(new Error("阶段工作流配置基线暂时不可用。"))
        : apiClient.getStageWorkflowEditableBaseline(workflowId),
    enabled:
      open && editing && workflowId !== undefined && apiClient !== null && canManageWorkflows,
  });
  const baseline = baselineQuery.data;
  const selectedObjectType = editing ? (baseline?.objectType ?? null) : createObjectType;
  const objectTypesQuery = useQuery({
    queryKey: stageWorkflowKeys.configurationOptions(identityKey, null),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("阶段工作流配置目录暂时不可用。"))
        : apiClient.getStageWorkflowConfigurationOptions(),
    enabled: open && !editing && apiClient !== null && canManageWorkflows,
  });
  const catalogQuery = useQuery({
    queryKey: stageWorkflowKeys.configurationOptions(identityKey, selectedObjectType),
    queryFn: () =>
      apiClient === null || selectedObjectType === null
        ? Promise.reject(new Error("阶段工作流配置目录暂时不可用。"))
        : apiClient.getStageWorkflowConfigurationOptions(selectedObjectType),
    enabled: open && selectedObjectType !== null && apiClient !== null && canManageWorkflows,
  });
  const catalog = catalogQuery.data;

  useEffect(() => {
    if (!open || !editing || baseline === undefined) return;
    const values = toStageWorkflowConfigurationValues(baseline);
    form.setFieldsValue({
      applicableActorIds: [...values.applicableActorIds],
      applicableDepartmentIds: [...values.applicableDepartmentIds],
      failureName: values.failureName,
      name: values.name,
      objectType: values.objectType,
      stages: toFormStages(values.stages),
      successName: values.successName,
    });
  }, [baseline, editing, form, open]);

  const saveMutation = useMutation({
    mutationFn: (values: StageWorkflowConfigurationFormValues) => {
      const configuration = toConfigurationValues(values);
      const request =
        configuration === null || catalog === undefined
          ? null
          : toStageWorkflowConfigurationRequest(configuration, catalog, baseline?.version);
      if (apiClient === null || request === null) {
        return Promise.reject(new Error("阶段工作流配置数据不完整。"));
      }
      return editing && workflowId !== undefined
        ? apiClient.updateStageWorkflow(workflowId, request)
        : apiClient.createStageWorkflow(request);
    },
    onSuccess: (workflow) => {
      void queryClient.invalidateQueries({ queryKey: stageWorkflowKeys.all });
      close();
      onSaved(workflow.id);
    },
  });

  function close() {
    if (saveMutation.isPending) return;
    form.resetFields();
    setFormError(null);
    setCreateObjectType(null);
    onClose();
  }

  function submit(values: StageWorkflowConfigurationFormValues) {
    const configuration = toConfigurationValues(values);
    const request =
      configuration === null || catalog === undefined
        ? null
        : toStageWorkflowConfigurationRequest(configuration, catalog, baseline?.version);
    if (request === null || (editing && baseline?.canUpdate !== true)) {
      setFormError("配置基线不完整、已过期或包含服务端不允许重写的内容。请刷新后重试。");
      return;
    }
    setFormError(null);
    saveMutation.mutate(values);
  }

  const canRenderForm =
    !editing || (baseline !== undefined && baseline.canUpdate && catalog !== undefined);
  const objectTypeOptions = (objectTypesQuery.data?.objectTypes ?? []).map((objectType) => ({
    label: objectType.displayName,
    value: objectType.code,
  }));
  const writableFieldOptions = (catalog?.fields ?? [])
    .filter((field) => field.writable && field.requiredFieldEligible)
    .map((field) => ({ label: field.displayName, value: field.code }));
  const approvalDefinitionOptions = (catalog?.approvalDefinitions ?? []).map((definition) => ({
    label: definition.name,
    value: definition.id,
  }));

  return (
    <Modal
      destroyOnHidden
      footer={null}
      open={open}
      title={editing ? "编辑阶段工作流" : "新建停用阶段工作流"}
      width={960}
      onCancel={close}
    >
      <Typography.Paragraph type="secondary">
        业务对象、可作必填项的字段、审批定义、成员和部门均只来自当前服务端配置目录。保存会发送完整版本化配置；服务端会再次校验资源动作、作用范围、引用和状态机。
      </Typography.Paragraph>
      {baselineQuery.isLoading || catalogQuery.isLoading ? <Spin /> : null}
      {baselineQuery.isError ? (
        <Alert title="阶段工作流配置基线暂时无法加载" showIcon type="error" />
      ) : null}
      {objectTypesQuery.isError || catalogQuery.isError ? (
        <Alert title="阶段工作流配置目录暂时无法加载" showIcon type="error" />
      ) : null}
      {editing && baseline !== undefined && !baseline.canUpdate ? (
        <Alert
          title="服务端未允许完整替换当前定义，或至少一个阶段不是可安全编辑的配置。"
          showIcon
          type="info"
        />
      ) : null}
      {formError !== null ? <Alert title={formError} showIcon type="warning" /> : null}
      {saveMutation.isError ? (
        <Alert
          title={
            saveMutation.error instanceof ApiError
              ? saveMutation.error.message
              : "阶段工作流暂时无法保存"
          }
          showIcon
          type="error"
        />
      ) : null}
      {canRenderForm ? (
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            label="流程名称"
            name="name"
            rules={[
              { required: true, whitespace: true, message: "请输入流程名称" },
              { max: 200, message: "流程名称不能超过 200 个字符" },
            ]}
          >
            <Input aria-label="流程名称" maxLength={200} />
          </Form.Item>
          <Form.Item
            label="业务对象"
            name="objectType"
            rules={[{ required: true, message: "请选择业务对象" }]}
          >
            {editing ? (
              <Input readOnly value={baseline?.objectType} />
            ) : (
              <Select
                aria-label="业务对象"
                loading={objectTypesQuery.isLoading}
                options={objectTypeOptions}
                onChange={(objectType: StageWorkflowObjectType) => {
                  setCreateObjectType(objectType);
                  form.setFieldValue("stages", []);
                }}
              />
            )}
          </Form.Item>
          <Space size="middle" style={{ display: "flex" }}>
            <Form.Item
              label="成功结果名称"
              name="successName"
              rules={[
                { required: true, whitespace: true, message: "请输入成功结果名称" },
                { max: 100, message: "不能超过 100 个字符" },
              ]}
              style={{ flex: 1 }}
            >
              <Input aria-label="成功结果名称" maxLength={100} />
            </Form.Item>
            <Form.Item
              label="失败结果名称"
              name="failureName"
              rules={[
                { required: true, whitespace: true, message: "请输入失败结果名称" },
                { max: 100, message: "不能超过 100 个字符" },
              ]}
              style={{ flex: 1 }}
            >
              <Input aria-label="失败结果名称" maxLength={100} />
            </Form.Item>
          </Space>
          <ScopeCandidateSelect
            candidateType="MEMBER"
            form={form}
            label="适用成员"
            name="applicableActorIds"
            open={open}
          />
          <ScopeCandidateSelect
            candidateType="DEPARTMENT"
            form={form}
            label="适用部门"
            name="applicableDepartmentIds"
            open={open}
          />
          <Typography.Title level={4}>阶段</Typography.Title>
          <Form.List name="stages">
            {(stageFields, { add, remove }) => (
              <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
                {stageFields.map((stageField, stageIndex) => (
                  <Card
                    key={stageField.key}
                    size="small"
                    title={`阶段 ${stageIndex + 1}`}
                    extra={
                      <Button
                        aria-label={`删除阶段 ${stageIndex + 1}`}
                        icon={<DeleteOutlined />}
                        type="text"
                        onClick={() => remove(stageField.name)}
                      />
                    }
                  >
                    <Space size="middle" style={{ display: "flex" }} wrap>
                      <Form.Item
                        label="阶段 code"
                        name={[stageField.name, "code"]}
                        rules={[
                          { required: true, whitespace: true, message: "请输入阶段 code" },
                          { max: 64, message: "不能超过 64 个字符" },
                        ]}
                      >
                        <Input aria-label={`阶段 ${stageIndex + 1} code`} maxLength={64} />
                      </Form.Item>
                      <Form.Item
                        label="阶段名称"
                        name={[stageField.name, "name"]}
                        rules={[
                          { required: true, whitespace: true, message: "请输入阶段名称" },
                          { max: 100, message: "不能超过 100 个字符" },
                        ]}
                      >
                        <Input aria-label={`阶段 ${stageIndex + 1} 名称`} maxLength={100} />
                      </Form.Item>
                      <Form.Item
                        label="顺序"
                        name={[stageField.name, "order"]}
                        rules={[{ required: true, message: "请输入阶段顺序" }]}
                      >
                        <InputNumber
                          aria-label={`阶段 ${stageIndex + 1} 顺序`}
                          max={10_000}
                          min={0}
                        />
                      </Form.Item>
                      <Form.Item
                        label="概率"
                        name={[stageField.name, "probability"]}
                        rules={[{ required: true, message: "请输入阶段概率" }]}
                      >
                        <InputNumber aria-label={`阶段 ${stageIndex + 1} 概率`} max={100} min={0} />
                      </Form.Item>
                    </Space>
                    <Form.Item label="必填字段" name={[stageField.name, "requiredFieldCodes"]}>
                      <Select
                        aria-label={`阶段 ${stageIndex + 1} 必填字段`}
                        mode="multiple"
                        options={writableFieldOptions}
                        placeholder="仅显示服务端允许配置为必填的字段"
                      />
                    </Form.Item>
                    <Form.Item label="审批定义" name={[stageField.name, "approvalDefinitionId"]}>
                      <Select
                        allowClear
                        aria-label={`阶段 ${stageIndex + 1} 审批定义`}
                        options={approvalDefinitionOptions}
                        placeholder="可选；仅显示服务端授权的定义"
                      />
                    </Form.Item>
                    <Form.List name={[stageField.name, "tasks"]}>
                      {(taskFields, { add: addTask, remove: removeTask }) => (
                        <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                          <Typography.Text strong>阶段任务</Typography.Text>
                          {taskFields.map((taskField, taskIndex) => (
                            <Space key={taskField.key} align="start" wrap>
                              <Form.Item
                                name={[taskField.name, "code"]}
                                rules={[
                                  { required: true, whitespace: true, message: "请输入任务 code" },
                                  { max: 64, message: "不能超过 64 个字符" },
                                ]}
                              >
                                <Input
                                  aria-label={`阶段 ${stageIndex + 1} 任务 ${taskIndex + 1} code`}
                                  placeholder="任务 code"
                                />
                              </Form.Item>
                              <Form.Item
                                name={[taskField.name, "name"]}
                                rules={[
                                  { required: true, whitespace: true, message: "请输入任务名称" },
                                  { max: 100, message: "不能超过 100 个字符" },
                                ]}
                              >
                                <Input
                                  aria-label={`阶段 ${stageIndex + 1} 任务 ${taskIndex + 1} 名称`}
                                  placeholder="任务名称"
                                />
                              </Form.Item>
                              <Form.Item
                                name={[taskField.name, "required"]}
                                valuePropName="checked"
                              >
                                <Checkbox
                                  aria-label={`阶段 ${stageIndex + 1} 任务 ${taskIndex + 1} 必填`}
                                >
                                  必填
                                </Checkbox>
                              </Form.Item>
                              <Button
                                aria-label={`删除阶段 ${stageIndex + 1} 任务 ${taskIndex + 1}`}
                                icon={<DeleteOutlined />}
                                type="text"
                                onClick={() => removeTask(taskField.name)}
                              />
                            </Space>
                          ))}
                          <Button
                            icon={<PlusOutlined />}
                            size="small"
                            onClick={() => addTask({ required: false })}
                          >
                            添加任务
                          </Button>
                        </Space>
                      )}
                    </Form.List>
                  </Card>
                ))}
                <Button
                  disabled={
                    selectedObjectType === null || catalogQuery.isLoading || catalogQuery.isError
                  }
                  icon={<PlusOutlined />}
                  onClick={() =>
                    add({
                      order: stageFields.length,
                      probability: 0,
                      requiredFieldCodes: [],
                      tasks: [],
                    })
                  }
                >
                  添加阶段
                </Button>
              </Space>
            )}
          </Form.List>
          <Space style={{ marginTop: 16 }}>
            <Button onClick={close}>取消</Button>
            <Button
              disabled={!canManageWorkflows || catalog === undefined || catalogQuery.isError}
              htmlType="submit"
              loading={saveMutation.isPending}
              type="primary"
            >
              {editing ? "保存完整配置" : "创建停用流程"}
            </Button>
          </Space>
        </Form>
      ) : null}
    </Modal>
  );
}
