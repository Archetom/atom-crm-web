import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Descriptions,
  Drawer,
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
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  defaultPageRequest,
  normalizePageRequest,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";

import { marketingKeys } from "../model/query-keys";

type MarketingForm = components["schemas"]["MarketingFormResponse"];
type Configuration = components["schemas"]["MarketingFormConfigurationOptionsResponse"];
type MarketingFormTargetObjectType = MarketingForm["targetObjectType"];

interface MarketingFieldDraft {
  fieldCode: string;
  helpText?: string;
  label: string;
  placeholder?: string;
  required: boolean;
}

interface MarketingFormDraft {
  description?: string;
  fields: MarketingFieldDraft[];
  name: string;
  submitButtonText?: string;
  successMessage?: string;
  targetObjectType: MarketingFormTargetObjectType;
  title: string;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function pageFromSearch(search: URLSearchParams) {
  return normalizePageRequest({
    page: Number.parseInt(search.get("page") ?? "", 10),
    size: Number.parseInt(search.get("size") ?? "", 10),
  });
}

function pageResult(
  response: components["schemas"]["MarketingFormPageResponse"],
): PageResult<MarketingForm> {
  return {
    items: response.objectList,
    meta: {},
    page: response.pageNum,
    size: response.pageSize,
    total: response.totalNum,
  };
}

function asDate(value: Dayjs): string {
  return value.format("YYYY-MM-DD");
}

function selectedFieldCodes(fields: readonly MarketingFieldDraft[] | undefined): string[] {
  return fields?.map((field) => field.fieldCode) ?? [];
}

function targetObjectTypeLabel(targetObjectType: MarketingFormTargetObjectType): string {
  return targetObjectType === "CUSTOMER" ? "客户" : "线索";
}

function toDraft(source: MarketingForm | null): MarketingFormDraft {
  return {
    description: source?.description,
    fields:
      source?.fields.map((field) => ({
        fieldCode: field.fieldCode,
        helpText: field.helpText,
        label: field.label,
        placeholder: field.placeholder,
        required: field.required,
      })) ?? [],
    name: source?.name ?? "",
    submitButtonText: source?.submitButtonText,
    successMessage: source?.successMessage,
    targetObjectType: source?.targetObjectType ?? "LEAD",
    title: source?.title ?? "",
  };
}

function toFields(
  draft: MarketingFormDraft,
  configuration: Configuration | undefined,
): components["schemas"]["MarketingFormFieldRequest"][] {
  const available = new Map(configuration?.fields.map((field) => [field.fieldCode, field]));
  if (
    draft.fields.length === 0 ||
    new Set(draft.fields.map((field) => field.fieldCode)).size !== draft.fields.length
  ) {
    throw new Error("请至少选择一个不重复的服务端允许字段。");
  }
  return draft.fields.map((field, index) => {
    const definition = available.get(field.fieldCode);
    if (definition === undefined) throw new Error("已选字段不再允许配置，请刷新后重试。");
    return {
      fieldCode: field.fieldCode,
      helpText: field.helpText?.trim() || undefined,
      label: field.label.trim(),
      placeholder: field.placeholder?.trim() || undefined,
      required: definition.required || field.required,
      sortOrder: (index + 1) * 10,
    };
  });
}

function toCreateRequest(
  draft: MarketingFormDraft,
  configuration: Configuration | undefined,
): components["schemas"]["MarketingFormCreateRequest"] {
  return {
    description: draft.description?.trim() || undefined,
    fields: toFields(draft, configuration),
    name: draft.name.trim(),
    submitButtonText: draft.submitButtonText?.trim() || undefined,
    successMessage: draft.successMessage?.trim() || undefined,
    targetObjectType: draft.targetObjectType,
    title: draft.title.trim(),
  };
}

function toUpdateRequest(
  draft: MarketingFormDraft,
  configuration: Configuration | undefined,
  source: MarketingForm,
): components["schemas"]["MarketingFormUpdateRequest"] {
  return {
    description: draft.description?.trim() || undefined,
    fields: toFields(draft, configuration),
    name: draft.name.trim(),
    submitButtonText: draft.submitButtonText?.trim() || undefined,
    successMessage: draft.successMessage?.trim() || undefined,
    title: draft.title.trim(),
    version: source.version,
  };
}

function FormEditor({
  configuration,
  form,
  onCancel,
  onSubmit,
  open,
  source,
  submitting,
}: Readonly<{
  configuration: Configuration | undefined;
  form: ReturnType<typeof Form.useForm<MarketingFormDraft>>[0];
  onCancel: () => void;
  onSubmit: (draft: MarketingFormDraft) => void;
  open: boolean;
  source: MarketingForm | null;
  submitting: boolean;
}>) {
  const fields = Form.useWatch("fields", form) ?? [];
  const targetObjectType = Form.useWatch("targetObjectType", form) ?? "LEAD";
  const currentCodes = selectedFieldCodes(fields);

  function changeFields(fieldCodes: string[]) {
    const existing = new Map(fields.map((field) => [field.fieldCode, field]));
    form.setFieldValue(
      "fields",
      fieldCodes.flatMap((fieldCode) => {
        const current = existing.get(fieldCode);
        const definition = configuration?.fields.find((field) => field.fieldCode === fieldCode);
        if (current) return [current];
        if (definition === undefined) return [];
        return [
          {
            fieldCode,
            label: definition.displayName,
            required: definition.required,
          },
        ];
      }),
    );
  }

  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ loading: submitting }}
      okText={source === null ? "创建草稿" : "保存"}
      onCancel={onCancel}
      onOk={() => form.submit()}
      open={open}
      title={source === null ? "新建营销表单" : "编辑营销表单"}
      width={720}
    >
      <Form<MarketingFormDraft> form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item
          label="内部名称"
          name="name"
          rules={[{ required: true, message: "请输入内部名称" }]}
        >
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item
          extra={
            source === null
              ? "创建后不可改变；字段目录将按所选对象和当前所有者权限重新加载。"
              : "表单目标已创建时固定，不能修改。"
          }
          label="采集对象"
          name="targetObjectType"
          rules={[{ required: true, message: "请选择采集对象" }]}
        >
          <Select
            disabled={source !== null}
            onChange={() => form.setFieldValue("fields", [])}
            options={(["CUSTOMER", "LEAD"] as const).map((value) => ({
              label: targetObjectTypeLabel(value),
              value,
            }))}
          />
        </Form.Item>
        <Form.Item
          label="公开标题"
          name="title"
          rules={[{ required: true, message: "请输入公开标题" }]}
        >
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item label="表单说明" name="description">
          <Input.TextArea maxLength={4000} rows={3} />
        </Form.Item>
        <Form.Item label="提交按钮文字" name="submitButtonText">
          <Input maxLength={100} placeholder="提交" />
        </Form.Item>
        <Form.Item label="提交成功提示" name="successMessage">
          <Input.TextArea maxLength={1000} rows={2} />
        </Form.Item>
        <Form.Item label="字段（仅显示服务端按所有者权限过滤后的选项）">
          <Select
            loading={configuration === undefined}
            mode="multiple"
            onChange={changeFields}
            options={configuration?.fields.map((field) => ({
              label: `${field.displayName}（${field.fieldType}）`,
              value: field.fieldCode,
            }))}
            placeholder={`选择公开收集的${targetObjectTypeLabel(targetObjectType)}字段`}
            value={currentCodes}
          />
        </Form.Item>
        <Form.List name="fields">
          {(items) =>
            items.map((item, index) => {
              const field = fields[index];
              const definition = configuration?.fields.find(
                (candidate) => candidate.fieldCode === field?.fieldCode,
              );
              return (
                <Space
                  align="start"
                  orientation="vertical"
                  key={item.key}
                  size="small"
                  style={{ borderTop: "1px solid #f0f0f0", display: "flex", paddingTop: 12 }}
                >
                  <Typography.Text strong>
                    {definition?.displayName ?? field?.fieldCode}
                  </Typography.Text>
                  <Form.Item hidden name={[item.name, "fieldCode"]}>
                    <Input />
                  </Form.Item>
                  <Form.Item
                    label="显示名称"
                    name={[item.name, "label"]}
                    rules={[{ required: true, message: "请输入字段显示名称" }]}
                  >
                    <Input maxLength={200} />
                  </Form.Item>
                  <Form.Item label="提示文字" name={[item.name, "placeholder"]}>
                    <Input maxLength={300} />
                  </Form.Item>
                  <Form.Item label="帮助说明" name={[item.name, "helpText"]}>
                    <Input maxLength={1000} />
                  </Form.Item>
                  <Form.Item name={[item.name, "required"]} valuePropName="checked">
                    <Checkbox disabled={definition?.required === true}>此字段必填</Checkbox>
                  </Form.Item>
                </Space>
              );
            })
          }
        </Form.List>
      </Form>
    </Modal>
  );
}

export function MarketingFormsPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editorSource, setEditorSource] = useState<MarketingForm | null | undefined>(undefined);
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [dayjs().subtract(29, "day"), dayjs()]);
  const [form] = Form.useForm<MarketingFormDraft>();
  const editorTargetObjectType =
    Form.useWatch("targetObjectType", form) ?? editorSource?.targetObjectType ?? "LEAD";
  const identityKey = authState?.identityKey ?? "pending";
  const canWrite = hasAuthority(authorization, authority.marketingFormsWrite);
  const page = useMemo(() => pageFromSearch(searchParams), [searchParams]);
  const formsQuery = useQuery({
    queryKey: marketingKeys.forms(identityKey, page.page, page.size),
    queryFn: () =>
      apiClient?.getMarketingForms(page) ?? Promise.reject(new Error("营销表单暂时无法加载。")),
    enabled: apiClient !== null,
  });
  const selectedFormQuery = useQuery({
    queryKey: marketingKeys.form(identityKey, selectedFormId ?? 0),
    queryFn: () =>
      apiClient === null || selectedFormId === null
        ? Promise.reject(new Error("营销表单详情暂时不可用。"))
        : apiClient.getMarketingForm(selectedFormId),
    enabled: apiClient !== null && selectedFormId !== null,
  });
  const selectedForm = selectedFormQuery.data;
  const configurationQuery = useQuery({
    queryKey: marketingKeys.configuration(
      identityKey,
      editorSource?.id,
      editorSource === null ? editorTargetObjectType : undefined,
    ),
    queryFn: () =>
      apiClient?.getMarketingFormConfigurationOptions(
        editorSource?.id,
        editorSource === null ? editorTargetObjectType : undefined,
      ) ?? Promise.reject(new Error("表单配置目录暂时无法加载。")),
    enabled: apiClient !== null && editorSource !== undefined && canWrite,
  });
  const trendQuery = useQuery({
    queryKey: marketingKeys.trend(
      identityKey,
      selectedFormId ?? 0,
      asDate(range[0]),
      asDate(range[1]),
    ),
    queryFn: () => {
      if (apiClient === null || selectedFormId === null)
        return Promise.reject(new Error("趋势暂时无法加载。"));
      return apiClient.getMarketingFormSubmissionTrend(selectedFormId, {
        from: asDate(range[0]),
        granularity: "DAY",
        to: asDate(range[1]),
      });
    },
    enabled: apiClient !== null && selectedForm !== undefined,
  });
  const submissionsQuery = useQuery({
    queryKey: marketingKeys.submissions(identityKey, selectedFormId ?? 0, 1, 20),
    queryFn: () => {
      if (apiClient === null || selectedFormId === null)
        return Promise.reject(new Error("提交记录暂时无法加载。"));
      return apiClient.getMarketingFormSubmissionLinks(selectedFormId, {
        from: asDate(range[0]),
        page: 1,
        size: 20,
        to: asDate(range[1]),
      });
    },
    enabled: apiClient !== null && selectedForm !== undefined,
  });
  const saveMutation = useMutation({
    mutationFn: ({
      draft,
      source,
    }: {
      draft: MarketingFormDraft;
      source: MarketingForm | null;
    }) => {
      if (apiClient === null) return Promise.reject(new Error("营销表单暂时无法保存。"));
      return source === null
        ? apiClient.createMarketingForm(toCreateRequest(draft, configurationQuery.data))
        : apiClient.updateMarketingForm(
            source.id,
            toUpdateRequest(draft, configurationQuery.data, source),
          );
    },
    onSuccess: () => {
      setEditorSource(undefined);
      void queryClient.invalidateQueries({ queryKey: marketingKeys.all });
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ source, status }: { source: MarketingForm; status: "ACTIVE" | "INACTIVE" }) => {
      if (apiClient === null) return Promise.reject(new Error("表单状态暂时无法更新。"));
      return apiClient.updateMarketingFormStatus(source.id, { status, version: source.version });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(marketingKeys.form(identityKey, updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: marketingKeys.all });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (source: MarketingForm) => {
      if (apiClient === null) return Promise.reject(new Error("营销表单暂时无法删除。"));
      return apiClient.deleteMarketingForm(source.id, source.version);
    },
    onSuccess: () => {
      setSelectedFormId(null);
      void queryClient.invalidateQueries({ queryKey: marketingKeys.all });
    },
  });
  const result = formsQuery.data
    ? pageResult(formsQuery.data)
    : { ...defaultPageRequest, items: [], meta: {}, total: null };
  const columns: ColumnsType<MarketingForm> = [
    { dataIndex: "name", key: "name", title: "名称" },
    {
      dataIndex: "targetObjectType",
      key: "targetObjectType",
      title: "采集对象",
      render: (value: MarketingFormTargetObjectType) => <Tag>{targetObjectTypeLabel(value)}</Tag>,
    },
    { dataIndex: "title", key: "title", title: "公开标题" },
    { dataIndex: "status", key: "status", title: "状态", render: (status) => <Tag>{status}</Tag> },
    { dataIndex: "publicId", key: "publicId", title: "公开标识" },
    {
      key: "actions",
      title: "操作",
      render: (_, source) => <Button onClick={() => setSelectedFormId(source.id)}>查看</Button>,
    },
  ];

  function openEditor(source: MarketingForm | null) {
    form.setFieldsValue(toDraft(source));
    setEditorSource(source);
  }

  return (
    <RouteAuthority authority={authority.marketingFormsRead}>
      <main>
        <Typography.Title level={2}>营销表单</Typography.Title>
        <Typography.Paragraph type="secondary">
          表单字段只取自后端按表单所有者权限筛选的目录。公开链接不加载内部身份、导航或授权数据。
        </Typography.Paragraph>
        <ActionAuthority authority={authority.marketingFormsWrite}>
          <Button onClick={() => openEditor(null)} type="primary">
            新建表单
          </Button>
        </ActionAuthority>
        {formsQuery.isError ? (
          <Alert
            title={errorMessage(formsQuery.error, "营销表单暂时无法加载")}
            showIcon
            style={{ marginTop: 16 }}
            type="error"
          />
        ) : null}
        <ResponsiveDataList
          columns={columns}
          loading={formsQuery.isLoading}
          onPageChange={(nextPage, size) => {
            const next = new URLSearchParams(searchParams);
            next.set("page", String(nextPage));
            next.set("size", String(size));
            setSearchParams(next);
          }}
          page={result}
          renderMobileItem={(source) => (
            <Space orientation="vertical" size="small" style={{ display: "flex" }}>
              <Typography.Text strong>{source.name}</Typography.Text>
              <Typography.Text>{targetObjectTypeLabel(source.targetObjectType)}</Typography.Text>
              <Typography.Text>{source.title}</Typography.Text>
              <Tag>{source.status}</Tag>
              <Button onClick={() => setSelectedFormId(source.id)} size="small">
                查看
              </Button>
            </Space>
          )}
          rowKey={(source) => source.id}
        />
      </main>
      <FormEditor
        configuration={configurationQuery.data}
        form={form}
        onCancel={() => setEditorSource(undefined)}
        onSubmit={(draft) => saveMutation.mutate({ draft, source: editorSource ?? null })}
        open={editorSource !== undefined}
        source={editorSource ?? null}
        submitting={saveMutation.isPending}
      />
      <Drawer
        destroyOnHidden
        onClose={() => setSelectedFormId(null)}
        open={selectedFormId !== null}
        title="营销表单详情"
        width={720}
      >
        {selectedFormQuery.isLoading ? (
          <div
            aria-label="正在加载营销表单详情"
            style={{ display: "grid", minHeight: 240, placeItems: "center" }}
          >
            <Spin size="large" />
          </div>
        ) : null}
        {selectedFormQuery.isError ? (
          <Alert
            title={errorMessage(selectedFormQuery.error, "营销表单详情暂时无法加载")}
            showIcon
            type="error"
          />
        ) : null}
        {selectedForm === undefined ? null : (
          <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="名称">{selectedForm.name}</Descriptions.Item>
              <Descriptions.Item label="采集对象">
                {targetObjectTypeLabel(selectedForm.targetObjectType)}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag>{selectedForm.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="公开链接">
                {`/public/marketing-forms/${selectedForm.publicId}`}
              </Descriptions.Item>
              <Descriptions.Item label="字段">
                {selectedForm.fields.map((field) => field.label).join("、")}
              </Descriptions.Item>
            </Descriptions>
            <ActionAuthority authority={authority.marketingFormsWrite}>
              <Space wrap>
                <Button onClick={() => openEditor(selectedForm)}>编辑</Button>
                {selectedForm.status === "INACTIVE" ? (
                  <Button
                    loading={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({ source: selectedForm, status: "ACTIVE" })
                    }
                  >
                    启用公开表单
                  </Button>
                ) : null}
                {selectedForm.status === "ACTIVE" ? (
                  <Button
                    loading={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({ source: selectedForm, status: "INACTIVE" })
                    }
                  >
                    停用公开表单
                  </Button>
                ) : null}
                {selectedForm.status === "INACTIVE" ? (
                  <Popconfirm
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    okText="删除"
                    onConfirm={() => deleteMutation.mutate(selectedForm)}
                    title="确认删除此营销表单？"
                  >
                    <Button danger loading={deleteMutation.isPending}>
                      删除
                    </Button>
                  </Popconfirm>
                ) : null}
              </Space>
            </ActionAuthority>
            {statusMutation.isError || deleteMutation.isError ? (
              <Alert
                title={errorMessage(
                  statusMutation.error ?? deleteMutation.error,
                  "表单操作暂时失败",
                )}
                showIcon
                type="error"
              />
            ) : null}
            <Typography.Title level={4}>提交趋势</Typography.Title>
            <DatePicker.RangePicker
              allowClear={false}
              onChange={(values) => {
                if (values?.[0] && values[1]) setRange([values[0], values[1]]);
              }}
              value={range}
            />
            {trendQuery.isLoading ? <Spin size="small" /> : null}
            {trendQuery.isError ? (
              <Alert
                title={errorMessage(trendQuery.error, "趋势暂时无法加载")}
                showIcon
                type="error"
              />
            ) : null}
            {trendQuery.data ? (
              <Typography.Text>
                {trendQuery.data.points
                  .map((point) => `${point.periodStart}：${point.acceptedCount}`)
                  .join("；") || "暂无成功提交"}
              </Typography.Text>
            ) : null}
            <Typography.Title level={4}>关联记录</Typography.Title>
            {submissionsQuery.isLoading ? <Spin size="small" /> : null}
            {submissionsQuery.isError ? (
              <Alert
                title={errorMessage(submissionsQuery.error, "提交记录暂时无法加载")}
                showIcon
                type="error"
              />
            ) : null}
            {submissionsQuery.data?.objectList.map((submission) => (
              <Typography.Text key={submission.submissionId}>
                提交 #{submission.submissionId} →{" "}
                {targetObjectTypeLabel(submission.targetObjectType)} #{submission.targetRecordId}（
                {dayjs(submission.submittedTime).format("YYYY-MM-DD HH:mm")}）
              </Typography.Text>
            ))}
          </Space>
        )}
      </Drawer>
    </RouteAuthority>
  );
}
