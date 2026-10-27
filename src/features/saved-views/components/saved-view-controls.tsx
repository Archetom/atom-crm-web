import { DeleteOutlined, EditOutlined, PlusOutlined, StarFilled } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import type { FormInstance } from "antd";
import { useMemo, useState } from "react";

import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";

import { savedViewKeys } from "../model/query-keys";
import { resolveSavedView, type SavedView, type SavedViewSelection } from "../model/saved-view";

const allRecordsValue = "__all_records__";

type FieldDefinition = components["schemas"]["FieldDefinitionResponse"];
type FilterCondition = components["schemas"]["FilterConditionRequest"];
type SavedViewConditionRequest = components["schemas"]["SavedViewConditionRequest"];
type SavedViewConditionResponse = components["schemas"]["SavedViewConditionResponse"];
type EditableFilterCondition = FilterCondition &
  Partial<Pick<SavedViewConditionRequest, "exposed">>;

interface FilterConditionsFormValues {
  conditions?: EditableFilterCondition[];
}

interface SavedViewFormValues extends FilterConditionsFormValues {
  hidden?: boolean;
  name?: string;
}

interface AdvancedFilterFormValues extends FilterConditionsFormValues {
  defaultView?: boolean;
  name?: string;
  saveAsView?: boolean;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function operatorLabel(code: string): string {
  const labels: Record<string, string> = {
    BETWEEN: "介于",
    CONTAINS: "包含",
    EQ: "等于",
    GT: "大于",
    GTE: "大于等于",
    IN: "属于任一值",
    IS_EMPTY: "为空",
    IS_NOT_EMPTY: "不为空",
    LT: "小于",
    LTE: "小于等于",
    NOT_CONTAINS: "不包含",
    NOT_EQ: "不等于",
  };
  return labels[code] ?? code;
}

function valueCountHint(minimum: number, maximum: number): string {
  if (minimum === maximum) return `需要 ${minimum} 个值`;
  return `需要 ${minimum} 至 ${maximum} 个值`;
}

function FilterConditionValueEditor({
  conditionIndex,
  operator,
}: Readonly<{
  conditionIndex: number;
  operator: components["schemas"]["FilterOperatorOptionResponse"];
}>) {
  if (operator.maximumValueCount === 0) {
    return <Typography.Text type="secondary">此操作符不需要输入值。</Typography.Text>;
  }

  return (
    <Form.List
      name={["conditions", conditionIndex, "values"]}
      rules={[
        {
          validator: async (_, values: unknown) => {
            const count = Array.isArray(values) ? values.length : 0;
            if (count < operator.minimumValueCount || count > operator.maximumValueCount) {
              throw new Error(
                `该操作符${valueCountHint(operator.minimumValueCount, operator.maximumValueCount)}。`,
              );
            }
          },
        },
      ]}
    >
      {(valueFields, { add, remove }, { errors }) => (
        <>
          <Typography.Paragraph type="secondary">
            {valueCountHint(operator.minimumValueCount, operator.maximumValueCount)}
          </Typography.Paragraph>
          {valueFields.map(({ key, ...valueField }, valueIndex) => (
            <Space key={key} align="baseline" style={{ display: "flex" }}>
              <Form.Item
                {...valueField}
                rules={[{ required: true, message: "请输入筛选值" }, { max: 500 }]}
                style={{ flex: 1 }}
              >
                <Input
                  aria-label={`条件 ${conditionIndex + 1} 的值 ${valueIndex + 1}`}
                  maxLength={500}
                />
              </Form.Item>
              <Button
                disabled={valueFields.length <= operator.minimumValueCount}
                size="small"
                type="text"
                onClick={() => remove(valueField.name)}
              >
                删除
              </Button>
            </Space>
          ))}
          <Button
            disabled={valueFields.length >= operator.maximumValueCount}
            size="small"
            onClick={() => add("")}
          >
            添加值
          </Button>
          <Form.ErrorList errors={errors} />
        </>
      )}
    </Form.List>
  );
}

function SavedViewConditionEditor({
  conditionIndex,
  fields,
  form,
  onRemove,
  showExposureControl = false,
}: Readonly<{
  conditionIndex: number;
  fields: readonly FieldDefinition[];
  form: FormInstance<FilterConditionsFormValues>;
  onRemove: () => void;
  showExposureControl?: boolean;
}>) {
  const condition = Form.useWatch(["conditions", conditionIndex], form) as
    FilterCondition | undefined;
  const selectedField = fields.find((field) => field.code === condition?.fieldCode);
  const selectedOperator = selectedField?.filterOperators.find(
    (operator) => operator.code === condition?.operator,
  );

  function clearOperatorAndValues() {
    form.setFields([
      { name: ["conditions", conditionIndex, "operator"], value: undefined },
      { name: ["conditions", conditionIndex, "values"], value: [] },
    ]);
  }

  function initializeValues(operatorCode: string) {
    const operator = selectedField?.filterOperators.find((item) => item.code === operatorCode);
    form.setFields([
      {
        name: ["conditions", conditionIndex, "values"],
        value:
          operator === undefined
            ? []
            : Array.from({ length: operator.minimumValueCount }, () => ""),
      },
    ]);
  }

  return (
    <Card
      extra={
        <Button danger size="small" type="text" onClick={onRemove}>
          删除条件
        </Button>
      }
      size="small"
      style={{ marginBottom: 12 }}
      title={`条件 ${conditionIndex + 1}`}
    >
      <Form.Item
        label="字段"
        name={["conditions", conditionIndex, "fieldCode"]}
        rules={[{ required: true, message: "请选择字段" }]}
      >
        <Select
          options={fields.map((field) => ({
            label: `${field.displayName}（${field.code}）`,
            value: field.code,
          }))}
          placeholder="选择服务端允许筛选的字段"
          onChange={clearOperatorAndValues}
        />
      </Form.Item>
      <Form.Item
        label="操作符"
        name={["conditions", conditionIndex, "operator"]}
        rules={[{ required: true, message: "请选择操作符" }]}
      >
        <Select
          disabled={selectedField === undefined}
          options={(selectedField?.filterOperators ?? []).map((operator) => ({
            label: operatorLabel(operator.code),
            value: operator.code,
          }))}
          placeholder="先选择字段"
          onChange={initializeValues}
        />
      </Form.Item>
      {showExposureControl ? (
        <Form.Item name={["conditions", conditionIndex, "exposed"]} valuePropName="checked">
          <Checkbox>在列表中外露此条件</Checkbox>
        </Form.Item>
      ) : null}
      {selectedOperator === undefined ? (
        <Typography.Text type="secondary">
          选择操作符后，服务端允许的值数量会显示在这里。
        </Typography.Text>
      ) : (
        <FilterConditionValueEditor conditionIndex={conditionIndex} operator={selectedOperator} />
      )}
    </Card>
  );
}

function SavedViewEditorForm({
  entityLabel,
  fields,
  form,
  onFinish,
}: Readonly<{
  entityLabel: string;
  fields: readonly FieldDefinition[];
  form: ReturnType<typeof Form.useForm<SavedViewFormValues>>[0];
  onFinish: (values: SavedViewFormValues) => void;
}>) {
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        label="视图名称"
        name="name"
        rules={[{ required: true, whitespace: true, message: "请输入视图名称" }, { max: 100 }]}
      >
        <Input maxLength={100} />
      </Form.Item>
      <Form.Item name="hidden" valuePropName="checked">
        <Checkbox>{`在${entityLabel}列表选择器中隐藏此视图`}</Checkbox>
      </Form.Item>
      <Typography.Paragraph type="secondary">
        字段、操作符及其值数量均由服务端字段目录决定。保存后，服务端会再次校验筛选条件。
      </Typography.Paragraph>
      <Form.List name="conditions">
        {(conditionFields, { add, remove }) => (
          <>
            {conditionFields.map((conditionField) => (
              <SavedViewConditionEditor
                key={conditionField.key}
                conditionIndex={conditionField.name}
                fields={fields}
                form={form}
                onRemove={() => remove(conditionField.name)}
                showExposureControl
              />
            ))}
            <Button onClick={() => add({ exposed: false, values: [] })}>添加筛选条件</Button>
          </>
        )}
      </Form.List>
    </Form>
  );
}

function toFilterConditions(conditions: readonly EditableFilterCondition[]): FilterCondition[] {
  return conditions.map((condition) => ({
    fieldCode: condition.fieldCode,
    operator: condition.operator,
    values: condition.values,
  }));
}

function savedConditionsToFilters(
  conditions: readonly SavedViewConditionResponse[],
): FilterCondition[] {
  return toFilterConditions(conditions);
}

function toSavedViewConditions(
  conditions: readonly EditableFilterCondition[],
): SavedViewConditionRequest[] {
  return conditions.map((condition) => ({
    exposed: condition.exposed ?? false,
    fieldCode: condition.fieldCode,
    operator: condition.operator,
    values: condition.values,
  }));
}

function ExposedSavedViewFilterForm({
  fields,
  form,
  view,
  onFinish,
}: Readonly<{
  fields: readonly FieldDefinition[];
  form: FormInstance<FilterConditionsFormValues>;
  onFinish: (values: FilterConditionsFormValues) => void;
  view: SavedView;
}>) {
  const exposedConditions = view.conditions
    .map((condition, index) => ({ condition, index }))
    .filter(({ condition }) => condition.exposed);

  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Typography.Paragraph type="secondary">
        修改外露条件后点击“应用筛选”。未外露的条件将继续按当前筛选方案执行。
      </Typography.Paragraph>
      {exposedConditions.map(({ condition, index }) => {
        const field = fields.find((candidate) => candidate.code === condition.fieldCode);
        const operator = field?.filterOperators.find(
          (candidate) => candidate.code === condition.operator,
        );
        return (
          <Card
            key={`${condition.fieldCode}-${index}`}
            size="small"
            style={{ marginBottom: 12 }}
            title={`${field?.displayName ?? condition.fieldCode}：${operatorLabel(condition.operator)}`}
          >
            {operator === undefined ? (
              <Typography.Text type="secondary">
                此条件当前无法编辑；请在筛选方案中重新配置。
              </Typography.Text>
            ) : (
              <FilterConditionValueEditor conditionIndex={index} operator={operator} />
            )}
          </Card>
        );
      })}
    </Form>
  );
}

function TemporaryFilterForm({
  canSaveAsView,
  fields,
  form,
  onFinish,
}: Readonly<{
  canSaveAsView: boolean;
  fields: readonly FieldDefinition[];
  form: ReturnType<typeof Form.useForm<AdvancedFilterFormValues>>[0];
  onFinish: (values: AdvancedFilterFormValues) => void;
}>) {
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Typography.Paragraph type="secondary">
        筛选条件只应用到当前列表；字段、操作符和值数量均由服务端字段目录决定。
      </Typography.Paragraph>
      <Form.List name="conditions">
        {(conditionFields, { add, remove }) => (
          <>
            {conditionFields.map((conditionField) => (
              <SavedViewConditionEditor
                key={conditionField.key}
                conditionIndex={conditionField.name}
                fields={fields}
                form={form}
                onRemove={() => remove(conditionField.name)}
                showExposureControl
              />
            ))}
            <Button disabled={conditionFields.length >= 50} onClick={() => add({ values: [] })}>
              添加筛选条件
            </Button>
          </>
        )}
      </Form.List>
      {canSaveAsView ? (
        <>
          <Form.Item name="saveAsView" style={{ marginTop: 16 }} valuePropName="checked">
            <Checkbox>保存为筛选方案</Checkbox>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(previous, current) => previous.saveAsView !== current.saveAsView}
          >
            {({ getFieldValue }) =>
              getFieldValue("saveAsView") ? (
                <>
                  <Form.Item
                    label="筛选方案名称"
                    name="name"
                    rules={[
                      { required: true, whitespace: true, message: "请输入筛选方案名称" },
                      { max: 100 },
                    ]}
                  >
                    <Input maxLength={100} />
                  </Form.Item>
                  <Form.Item name="defaultView" valuePropName="checked">
                    <Checkbox>设置为默认</Checkbox>
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </>
      ) : null}
    </Form>
  );
}

interface SavedViewControlsProps {
  entityLabel: string;
  objectType: string;
  selection: SavedViewSelection;
  onSelectionChange: (selection: number | null) => void;
  temporaryConditions?: readonly FilterCondition[];
  onTemporaryConditionsChange?: (conditions: FilterCondition[]) => void;
}

export function SavedViewControls({
  entityLabel,
  objectType,
  selection,
  onSelectionChange,
  temporaryConditions = [],
  onTemporaryConditionsChange,
}: Readonly<SavedViewControlsProps>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [managerOpen, setManagerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [temporaryEditorOpen, setTemporaryEditorOpen] = useState(false);
  const [editingView, setEditingView] = useState<SavedView | null>(null);
  const [expandedFiltersOpen, setExpandedFiltersOpen] = useState(false);
  const [form] = Form.useForm<SavedViewFormValues>();
  const [temporaryForm] = Form.useForm<AdvancedFilterFormValues>();
  const [expandedFiltersForm] = Form.useForm<FilterConditionsFormValues>();
  const identityKey = authState?.identityKey ?? "pending";
  const canRead = hasAuthority(authorization, authority.savedViewsRead);
  const canWrite = hasAuthority(authorization, authority.savedViewsWrite);
  const canApplyTemporaryFilters = onTemporaryConditionsChange !== undefined;
  const viewsQuery = useQuery({
    queryKey: savedViewKeys.list(identityKey, objectType, true),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("保存视图暂时不可用。"))
        : apiClient.listSavedViews(objectType, true),
    enabled: apiClient !== null && canRead,
  });
  const fieldsQuery = useQuery({
    queryKey: savedViewKeys.fields(identityKey, objectType),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("字段目录暂时不可用。"))
        : apiClient.listFieldDefinitions(objectType, false),
    enabled:
      apiClient !== null && canRead && (editorOpen || expandedFiltersOpen || temporaryEditorOpen),
  });
  const views = viewsQuery.data ?? [];
  const filterableFields = useMemo(
    () =>
      (fieldsQuery.data ?? []).filter(
        (field) =>
          field.status === "ACTIVE" && field.searchable && field.filterOperators.length > 0,
      ),
    [fieldsQuery.data],
  );
  const activeView = resolveSavedView(views, selection);
  const invalidateViews = () =>
    queryClient.invalidateQueries({ queryKey: savedViewKeys.list(identityKey, objectType, true) });
  const saveMutation = useMutation({
    mutationFn: ({
      existing,
      values,
    }: {
      existing: SavedView | null;
      values: SavedViewFormValues;
    }) => {
      const name = values.name?.trim();
      if (!name) return Promise.reject(new Error("请输入视图名称。"));
      const conditions = toSavedViewConditions(values.conditions ?? []);
      if (apiClient === null) return Promise.reject(new Error("保存视图暂时不可用。"));
      if (existing === null) {
        return apiClient.createSavedView({
          conditions,
          hidden: values.hidden ?? false,
          name,
          objectType,
          sortOrder: 0,
        });
      }
      return apiClient.updateSavedView(existing.id, {
        conditions,
        hidden: values.hidden ?? false,
        name,
        sortOrder: existing.sortOrder,
        version: existing.version,
      });
    },
    onSuccess: (savedView, variables) => {
      void invalidateViews();
      if (variables.existing === null) onSelectionChange(savedView.id);
      closeEditor();
    },
  });
  const defaultMutation = useMutation({
    mutationFn: (view: SavedView) =>
      apiClient === null
        ? Promise.reject(new Error("保存视图暂时不可用。"))
        : apiClient.setDefaultSavedView(view.id, view.version),
    onSuccess: () => void invalidateViews(),
  });
  const deleteMutation = useMutation({
    mutationFn: (view: SavedView) =>
      apiClient === null
        ? Promise.reject(new Error("保存视图暂时不可用。"))
        : apiClient.deleteSavedView(view.id, view.version),
    onSuccess: (__, deletedView) => {
      void invalidateViews();
      if (activeView?.id === deletedView.id) onSelectionChange(null);
    },
  });
  const saveTemporaryViewMutation = useMutation({
    mutationFn: async ({
      conditions,
      defaultView,
      name,
    }: {
      conditions: EditableFilterCondition[];
      defaultView: boolean;
      name: string;
    }) => {
      if (apiClient === null) throw new Error("保存视图暂时不可用。");
      const savedView = await apiClient.createSavedView({
        conditions: toSavedViewConditions(conditions),
        hidden: false,
        name,
        objectType,
        sortOrder: 0,
      });
      return defaultView
        ? apiClient.setDefaultSavedView(savedView.id, savedView.version)
        : savedView;
    },
    onSuccess: (savedView) => {
      void invalidateViews();
      onTemporaryConditionsChange?.([]);
      onSelectionChange(savedView.id);
      temporaryForm.resetFields();
      setTemporaryEditorOpen(false);
    },
  });

  function closeEditor() {
    if (saveMutation.isPending) return;
    saveMutation.reset();
    form.resetFields();
    setEditingView(null);
    setEditorOpen(false);
  }

  function openCreate() {
    form.setFieldsValue({ conditions: [], hidden: false, name: "" });
    setEditingView(null);
    setEditorOpen(true);
  }

  function openEdit(view: SavedView) {
    form.setFieldsValue({
      conditions: view.conditions,
      hidden: view.hidden,
      name: view.name,
    });
    setEditingView(view);
    setEditorOpen(true);
  }

  function changeSelection(nextSelection: number | null) {
    setExpandedFiltersOpen(false);
    expandedFiltersForm.resetFields();
    onTemporaryConditionsChange?.([]);
    onSelectionChange(nextSelection);
  }

  function openExpandedFilters() {
    if (activeView === undefined) return;
    expandedFiltersForm.setFieldsValue({
      conditions: savedConditionsToFilters(activeView.conditions),
    });
    onTemporaryConditionsChange?.(savedConditionsToFilters(activeView.conditions));
    setExpandedFiltersOpen(true);
  }

  function closeExpandedFilters() {
    expandedFiltersForm.resetFields();
    onTemporaryConditionsChange?.([]);
    setExpandedFiltersOpen(false);
  }

  function applyExpandedFilters(values: FilterConditionsFormValues) {
    onTemporaryConditionsChange?.(toFilterConditions(values.conditions ?? []));
  }

  function clearExpandedFilters() {
    if (activeView === undefined) return;
    expandedFiltersForm.setFieldsValue({
      conditions: savedConditionsToFilters(activeView.conditions),
    });
    onTemporaryConditionsChange?.([]);
  }

  function openTemporaryEditor() {
    saveTemporaryViewMutation.reset();
    setExpandedFiltersOpen(false);
    temporaryForm.setFieldsValue({
      conditions: [...temporaryConditions],
      defaultView: false,
      name: "",
      saveAsView: false,
    });
    setTemporaryEditorOpen(true);
  }

  function closeTemporaryEditor() {
    if (saveTemporaryViewMutation.isPending) return;
    saveTemporaryViewMutation.reset();
    temporaryForm.resetFields();
    setTemporaryEditorOpen(false);
  }

  function applyTemporaryFilters(values: AdvancedFilterFormValues) {
    const conditions = values.conditions ?? [];
    if (values.saveAsView) {
      const name = values.name?.trim();
      if (!name) return;
      saveTemporaryViewMutation.mutate({
        conditions,
        defaultView: values.defaultView ?? false,
        name,
      });
      return;
    }
    expandedFiltersForm.resetFields();
    setExpandedFiltersOpen(false);
    onSelectionChange(null);
    onTemporaryConditionsChange?.(toFilterConditions(conditions));
    closeTemporaryEditor();
  }

  if (!canRead) return null;

  const mutationError = saveMutation.error ?? defaultMutation.error ?? deleteMutation.error;
  const options = [
    { label: `所有${entityLabel}（不使用保存视图）`, value: allRecordsValue },
    ...views.map((view) => ({
      label: view.defaultView ? `默认：${view.name}` : view.name,
      value: view.id,
    })),
  ];
  const canExpandActiveView =
    canApplyTemporaryFilters &&
    activeView?.conditions.some((condition) => condition.exposed) === true;

  return (
    <>
      <Space wrap>
        <Select
          aria-label={`${entityLabel}保存视图`}
          loading={viewsQuery.isLoading}
          options={options}
          style={{ minWidth: 220 }}
          value={activeView?.id ?? allRecordsValue}
          onChange={(value: number | string) =>
            changeSelection(value === allRecordsValue ? null : Number(value))
          }
        />
        <Button
          onClick={canApplyTemporaryFilters ? openTemporaryEditor : () => setManagerOpen(true)}
        >
          高级筛选
        </Button>
        <Button type="link" onClick={() => setManagerOpen(true)}>
          筛选方案
        </Button>
        {canExpandActiveView ? (
          <Button onClick={expandedFiltersOpen ? closeExpandedFilters : openExpandedFilters}>
            {expandedFiltersOpen ? "收起筛选" : "展开筛选"}
          </Button>
        ) : null}
      </Space>
      {expandedFiltersOpen && activeView !== undefined ? (
        <Card size="small" style={{ marginTop: 12 }} title="展开筛选">
          {fieldsQuery.isLoading ? <Spin /> : null}
          {fieldsQuery.isError ? (
            <Alert
              title={errorMessage(fieldsQuery.error, "字段目录暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          <div style={{ marginTop: 16 }}>
            <ExposedSavedViewFilterForm
              fields={filterableFields}
              form={expandedFiltersForm}
              view={activeView}
              onFinish={applyExpandedFilters}
            />
          </div>
          <Space>
            <Button onClick={clearExpandedFilters}>清除外露筛选</Button>
            <Button
              disabled={fieldsQuery.isLoading || fieldsQuery.isError}
              type="primary"
              onClick={() => expandedFiltersForm.submit()}
            >
              应用筛选
            </Button>
          </Space>
        </Card>
      ) : null}
      {viewsQuery.isError ? (
        <Alert
          title={errorMessage(viewsQuery.error, "保存视图暂时无法加载")}
          showIcon
          style={{ marginTop: 12 }}
          type="error"
        />
      ) : null}
      <Modal
        destroyOnHidden
        footer={null}
        open={managerOpen}
        title={`${entityLabel}筛选方案`}
        width={760}
        onCancel={() => setManagerOpen(false)}
      >
        <Typography.Paragraph type="secondary">
          筛选方案会在选择后应用；默认方案会在 URL 未指定视图时应用。选择“所有{entityLabel}
          ”会明确忽略默认方案。
        </Typography.Paragraph>
        {canWrite ? (
          <Space wrap>
            <Button icon={<PlusOutlined />} onClick={openCreate}>
              新建筛选方案
            </Button>
          </Space>
        ) : (
          <Alert
            title="你可以查看已保存的筛选方案，但修改方案需要 saved-views:write 权限。"
            showIcon
            type="info"
          />
        )}
        {mutationError ? (
          <Alert
            title={errorMessage(mutationError, "保存视图操作暂时无法完成")}
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
        {viewsQuery.isLoading ? <Spin style={{ display: "block", marginTop: 20 }} /> : null}
        <Space orientation="vertical" size="middle" style={{ display: "flex", marginTop: 16 }}>
          {views.map((view) => (
            <Card
              extra={
                canWrite ? (
                  <Space size="small">
                    <Button
                      disabled={view.defaultView}
                      icon={<StarFilled />}
                      loading={defaultMutation.isPending}
                      size="small"
                      onClick={() => defaultMutation.mutate(view)}
                    >
                      设为默认
                    </Button>
                    <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(view)}>
                      编辑
                    </Button>
                    <Popconfirm
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      okText="删除"
                      title="删除后无法恢复该保存视图。"
                      onConfirm={() => deleteMutation.mutate(view)}
                    >
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        loading={deleteMutation.isPending}
                        size="small"
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                ) : null
              }
              key={view.id}
              size="small"
              title={
                <Space>
                  <Typography.Text strong>{view.name}</Typography.Text>
                  {view.defaultView ? <Tag color="gold">默认</Tag> : null}
                  {view.hidden ? <Tag>已隐藏</Tag> : null}
                </Space>
              }
            >
              <Typography.Text type="secondary">
                {view.conditions.length === 0
                  ? "不含筛选条件"
                  : `包含 ${view.conditions.length} 个筛选条件`}
              </Typography.Text>
            </Card>
          ))}
        </Space>
      </Modal>
      <Modal
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={closeTemporaryEditor}>取消</Button>
            <Button
              disabled={
                fieldsQuery.isLoading || fieldsQuery.isError || saveTemporaryViewMutation.isPending
              }
              loading={saveTemporaryViewMutation.isPending}
              type="primary"
              onClick={() => temporaryForm.submit()}
            >
              确定
            </Button>
          </Space>
        }
        open={temporaryEditorOpen}
        title="高级筛选"
        width={720}
        onCancel={closeTemporaryEditor}
      >
        {fieldsQuery.isLoading ? <Spin /> : null}
        {fieldsQuery.isError ? (
          <Alert
            title={errorMessage(fieldsQuery.error, "字段目录暂时无法加载")}
            showIcon
            type="error"
          />
        ) : null}
        {saveTemporaryViewMutation.isError ? (
          <Alert
            title={errorMessage(saveTemporaryViewMutation.error, "保存筛选方案暂时无法完成")}
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
        <div style={{ marginTop: 16 }}>
          <TemporaryFilterForm
            canSaveAsView={canWrite}
            fields={filterableFields}
            form={temporaryForm}
            onFinish={applyTemporaryFilters}
          />
        </div>
      </Modal>
      <Modal
        destroyOnHidden
        footer={
          <Space>
            <Button disabled={saveMutation.isPending} onClick={closeEditor}>
              取消
            </Button>
            <Button
              disabled={fieldsQuery.isLoading || fieldsQuery.isError}
              loading={saveMutation.isPending}
              type="primary"
              onClick={() => form.submit()}
            >
              保存并应用
            </Button>
          </Space>
        }
        open={editorOpen}
        title={editingView === null ? `新建${entityLabel}筛选方案` : `编辑${entityLabel}筛选方案`}
        width={720}
        onCancel={closeEditor}
      >
        {fieldsQuery.isLoading ? <Spin /> : null}
        {fieldsQuery.isError ? (
          <Alert
            title={errorMessage(fieldsQuery.error, "字段目录暂时无法加载")}
            showIcon
            type="error"
          />
        ) : null}
        {saveMutation.isError ? (
          <Alert
            title={errorMessage(saveMutation.error, "保存视图暂时无法完成")}
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
        <div style={{ marginTop: 16 }}>
          <SavedViewEditorForm
            entityLabel={entityLabel}
            fields={filterableFields}
            form={form}
            onFinish={(values) => saveMutation.mutate({ existing: editingView, values })}
          />
        </div>
      </Modal>
    </>
  );
}
