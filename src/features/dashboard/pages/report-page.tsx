import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { formatMetric, formatServerAmount } from "../model/format";

import { dashboardKeys } from "../model/query-keys";
import {
  reportGranularities,
  reportMetrics,
  reportQueryFromSearchParams,
  withReportQuerySearchParams,
  type ReportQuery,
} from "../model/report-query";

type ReportCatalog = components["schemas"]["ReportCatalogResponse"];
type ReportDefinition = components["schemas"]["ReportDefinitionResponse"];
type ReportDefinitionSummary = components["schemas"]["ReportDefinitionSummaryResponse"];
type ReportFilterDraft = { fieldCode: string; operator: string; values?: string[] };
type ReportMeasureDraft = { fieldCode?: string; type: string };

interface ReportDefinitionDraft {
  description?: string;
  dimensionFieldCode?: string;
  filters: ReportFilterDraft[];
  granularity: string;
  measures: ReportMeasureDraft[];
  name: string;
  objectType: string;
  timeFieldCode: string;
}

function QueryFailure({ error }: Readonly<{ error: unknown }>) {
  return (
    <Alert
      title={error instanceof ApiError ? error.message : "报表暂时无法加载"}
      showIcon
      type="error"
    />
  );
}

function date(value: Dayjs): string {
  return value.format("YYYY-MM-DD");
}

function draftOf(source: ReportDefinition | null): ReportDefinitionDraft {
  return {
    description: source?.description,
    dimensionFieldCode: source?.dimensionFieldCode,
    filters:
      source?.filters.map((filter) => ({
        fieldCode: filter.fieldCode ?? "",
        operator: filter.operator ?? "",
        values: filter.values,
      })) ?? [],
    granularity: source?.granularity ?? "",
    measures: source?.measures.map((measure) => ({
      fieldCode: measure.fieldCode,
      type: measure.type,
    })) ?? [{ type: "COUNT" }],
    name: source?.name ?? "",
    objectType: source?.objectType ?? "",
    timeFieldCode: source?.timeFieldCode ?? "",
  };
}

function fieldByCode(
  fields: readonly components["schemas"]["ReportCatalogFieldResponse"][],
  fieldCode: string | undefined,
) {
  return fieldCode === undefined
    ? undefined
    : fields.find((field) => field.fieldCode === fieldCode);
}

function toMeasures(
  measures: readonly ReportMeasureDraft[],
  catalog: ReportCatalog | undefined,
): components["schemas"]["ReportMeasureRequest"][] {
  if (catalog === undefined || measures.length === 0) {
    throw new Error("报表指标目录暂时不可用，请稍后重试。");
  }
  return measures.map((measure) => {
    if (!catalog.measureTypes.includes(measure.type)) {
      throw new Error("所选指标不再受服务端支持，请刷新后重试。");
    }
    if (measure.type === "SUM") {
      if (fieldByCode(catalog.sumFields, measure.fieldCode) === undefined) {
        throw new Error("汇总字段必须来自当前服务端目录。");
      }
      return { fieldCode: measure.fieldCode, type: measure.type };
    }
    return { type: measure.type };
  });
}

function toFilters(
  filters: readonly ReportFilterDraft[],
  catalog: ReportCatalog | undefined,
): components["schemas"]["FilterConditionRequest"][] {
  if (catalog === undefined) throw new Error("报表筛选目录暂时不可用，请稍后重试。");
  return filters.map((filter) => {
    const field = fieldByCode(catalog.filterFields, filter.fieldCode);
    const values = (filter.values ?? []).map((value) => value.trim()).filter(Boolean);
    if (field === undefined || !field.operators.includes(filter.operator)) {
      throw new Error("筛选字段或运算符不再受服务端支持，请刷新后重试。");
    }
    if (
      field.options.length > 0 &&
      values.some((value) => !field.options.some((item) => item.value === value))
    ) {
      throw new Error("筛选值必须来自服务端下发的选项。");
    }
    return {
      fieldCode: field.fieldCode,
      operator: filter.operator,
      values: values.length === 0 ? undefined : values,
    };
  });
}

function toCreateRequest(
  draft: ReportDefinitionDraft,
  catalog: ReportCatalog | undefined,
): components["schemas"]["ReportDefinitionCreateRequest"] {
  const timeField = fieldByCode(catalog?.timeFields ?? [], draft.timeFieldCode);
  if (catalog === undefined || draft.objectType !== catalog.objectType || timeField === undefined) {
    throw new Error("时间字段必须来自当前服务端报表目录。");
  }
  if (!timeField.granularities.includes(draft.granularity)) {
    throw new Error("所选时间粒度不再受服务端支持，请刷新后重试。");
  }
  if (
    draft.dimensionFieldCode !== undefined &&
    draft.dimensionFieldCode !== "" &&
    fieldByCode(catalog.dimensionFields, draft.dimensionFieldCode) === undefined
  ) {
    throw new Error("维度字段必须来自当前服务端报表目录。");
  }
  return {
    description: draft.description?.trim() || undefined,
    dimensionFieldCode: draft.dimensionFieldCode || undefined,
    filters: toFilters(draft.filters, catalog),
    granularity: draft.granularity,
    measures: toMeasures(draft.measures, catalog),
    name: draft.name.trim(),
    objectType: catalog.objectType,
    timeFieldCode: timeField.fieldCode,
  };
}

function toUpdateRequest(
  draft: ReportDefinitionDraft,
  catalog: ReportCatalog | undefined,
  source: ReportDefinition,
): components["schemas"]["ReportDefinitionUpdateRequest"] {
  return { ...toCreateRequest(draft, catalog), version: source.version };
}

function DefinitionEditor({
  catalog,
  form,
  onCancel,
  onObjectTypeChange,
  onSubmit,
  open,
  source,
  submitting,
}: Readonly<{
  catalog: ReportCatalog | undefined;
  form: ReturnType<typeof Form.useForm<ReportDefinitionDraft>>[0];
  onCancel: () => void;
  onObjectTypeChange: (objectType: string) => void;
  onSubmit: (draft: ReportDefinitionDraft) => void;
  open: boolean;
  source: ReportDefinition | null;
  submitting: boolean;
}>) {
  const selectedTimeField = Form.useWatch("timeFieldCode", form);
  const measures = Form.useWatch("measures", form) ?? [];
  const filters = Form.useWatch("filters", form) ?? [];
  const timeField = fieldByCode(catalog?.timeFields ?? [], selectedTimeField);

  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ loading: submitting }}
      okText={source === null ? "创建" : "保存"}
      onCancel={onCancel}
      onOk={() => form.submit()}
      open={open}
      title={source === null ? "新建自定义报表" : "编辑自定义报表"}
      width={760}
    >
      <Form<ReportDefinitionDraft> form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item label="名称" name="name" rules={[{ required: true, message: "请输入报表名称" }]}>
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item label="说明" name="description">
          <Input.TextArea maxLength={1000} rows={2} />
        </Form.Item>
        <Form.Item
          label="业务对象"
          name="objectType"
          rules={[{ required: true, message: "请选择业务对象" }]}
        >
          <Select
            disabled={catalog === undefined}
            onChange={onObjectTypeChange}
            options={catalog?.supportedObjectTypes.map((objectType) => ({
              label: objectType,
              value: objectType,
            }))}
          />
        </Form.Item>
        <Form.Item
          label="时间字段"
          name="timeFieldCode"
          rules={[{ required: true, message: "请选择时间字段" }]}
        >
          <Select
            disabled={catalog === undefined}
            onChange={() => form.setFieldValue("granularity", undefined)}
            options={catalog?.timeFields.map((field) => ({
              label: `${field.displayName}（${field.fieldType}）`,
              value: field.fieldCode,
            }))}
          />
        </Form.Item>
        <Form.Item
          label="时间粒度"
          name="granularity"
          rules={[{ required: true, message: "请选择时间粒度" }]}
        >
          <Select
            disabled={timeField === undefined}
            options={timeField?.granularities.map((granularity) => ({
              label: granularity,
              value: granularity,
            }))}
          />
        </Form.Item>
        <Form.Item label="分组维度（可选）" name="dimensionFieldCode">
          <Select
            allowClear
            disabled={catalog === undefined}
            options={catalog?.dimensionFields.map((field) => ({
              label: `${field.displayName}（${field.fieldType}）`,
              value: field.fieldCode,
            }))}
          />
        </Form.Item>
        <Typography.Title level={5}>统计指标</Typography.Title>
        <Form.List name="measures">
          {(items, { add, remove }) => (
            <Space orientation="vertical" style={{ display: "flex" }}>
              {items.map((item, index) => {
                const measure = measures[index];
                return (
                  <Space align="start" key={item.key} wrap>
                    <Form.Item
                      name={[item.name, "type"]}
                      rules={[{ required: true, message: "请选择指标类型" }]}
                    >
                      <Select
                        aria-label={`第 ${index + 1} 个统计指标的类型`}
                        onChange={() =>
                          form.setFieldValue(["measures", item.name, "fieldCode"], undefined)
                        }
                        options={catalog?.measureTypes.map((type) => ({
                          label: type,
                          value: type,
                        }))}
                        style={{ minWidth: 130 }}
                      />
                    </Form.Item>
                    {measure?.type === "SUM" ? (
                      <Form.Item
                        name={[item.name, "fieldCode"]}
                        rules={[{ required: true, message: "请选择汇总字段" }]}
                      >
                        <Select
                          aria-label={`第 ${index + 1} 个统计指标的汇总字段`}
                          options={catalog?.sumFields.map((field) => ({
                            label: `${field.displayName}（${field.fieldType}）`,
                            value: field.fieldCode,
                          }))}
                          placeholder="汇总字段"
                          style={{ minWidth: 240 }}
                        />
                      </Form.Item>
                    ) : null}
                    <Button disabled={items.length === 1} onClick={() => remove(item.name)}>
                      移除
                    </Button>
                  </Space>
                );
              })}
              <Button onClick={() => add({ type: catalog?.measureTypes[0] ?? "COUNT" })}>
                添加指标
              </Button>
            </Space>
          )}
        </Form.List>
        <Typography.Title level={5} style={{ marginTop: 20 }}>
          筛选条件（可选）
        </Typography.Title>
        <Form.List name="filters">
          {(items, { add, remove }) => (
            <Space orientation="vertical" style={{ display: "flex" }}>
              {items.map((item, index) => {
                const filter = filters[index];
                const field = fieldByCode(catalog?.filterFields ?? [], filter?.fieldCode);
                return (
                  <Space align="start" key={item.key} wrap>
                    <Form.Item
                      name={[item.name, "fieldCode"]}
                      rules={[{ required: true, message: "请选择筛选字段" }]}
                    >
                      <Select
                        onChange={() => {
                          form.setFieldValue(["filters", item.name, "operator"], undefined);
                          form.setFieldValue(["filters", item.name, "values"], undefined);
                        }}
                        options={catalog?.filterFields.map((candidate) => ({
                          label: `${candidate.displayName}（${candidate.fieldType}）`,
                          value: candidate.fieldCode,
                        }))}
                        placeholder="筛选字段"
                        style={{ minWidth: 220 }}
                      />
                    </Form.Item>
                    <Form.Item
                      name={[item.name, "operator"]}
                      rules={[{ required: true, message: "请选择运算符" }]}
                    >
                      <Select
                        disabled={field === undefined}
                        options={field?.operators.map((operator) => ({
                          label: operator,
                          value: operator,
                        }))}
                        placeholder="运算符"
                        style={{ minWidth: 150 }}
                      />
                    </Form.Item>
                    <Form.Item name={[item.name, "values"]}>
                      {field?.options.length ? (
                        <Select
                          mode="multiple"
                          options={field.options.map((option) => ({
                            label: option.label,
                            value: option.value,
                          }))}
                          placeholder="服务端选项"
                          style={{ minWidth: 220 }}
                        />
                      ) : (
                        <Select mode="tags" placeholder="输入筛选值" style={{ minWidth: 220 }} />
                      )}
                    </Form.Item>
                    <Button onClick={() => remove(item.name)}>移除</Button>
                  </Space>
                );
              })}
              <Button onClick={() => add({})}>添加筛选条件</Button>
            </Space>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}

export function ReportPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editorSource, setEditorSource] = useState<ReportDefinition | null | undefined>(undefined);
  const [catalogObjectType, setCatalogObjectType] = useState<string | undefined>(undefined);
  const [selectedDefinition, setSelectedDefinition] = useState<ReportDefinitionSummary | null>(
    null,
  );
  const [runRange, setRunRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().subtract(29, "day"),
    dayjs(),
  ]);
  const [form] = Form.useForm<ReportDefinitionDraft>();
  const identityKey = authState?.identityKey ?? "pending";
  const canWrite = hasAuthority(authorization, authority.reportsWrite);
  const fixedReportQuery = reportQueryFromSearchParams(searchParams, dayjs());
  const definitionPage = Math.max(
    1,
    Number.parseInt(searchParams.get("definitionPage") ?? "1", 10) || 1,
  );
  const definitionSize = Math.max(
    1,
    Number.parseInt(searchParams.get("definitionSize") ?? "20", 10) || 20,
  );
  const coreQuery = useQuery({
    queryKey: [...dashboardKeys.reports(identityKey), "core"] as const,
    queryFn: () =>
      apiClient?.getCoreReport() ?? Promise.reject(new Error("Report API is unavailable.")),
    enabled: apiClient !== null,
  });
  const trendQuery = useQuery({
    queryKey: [...dashboardKeys.reports(identityKey), "trend", fixedReportQuery] as const,
    queryFn: () =>
      apiClient?.getReportTrend({
        from: fixedReportQuery.from,
        granularity: fixedReportQuery.granularity,
        metric: fixedReportQuery.metric,
        to: fixedReportQuery.to,
      }) ?? Promise.reject(new Error("Report API is unavailable.")),
    enabled: apiClient !== null,
  });
  const rankingQuery = useQuery({
    queryKey: [...dashboardKeys.reports(identityKey), "ranking", fixedReportQuery] as const,
    queryFn: () =>
      apiClient?.getReportRanking({
        from: fixedReportQuery.from,
        metric: fixedReportQuery.metric,
        to: fixedReportQuery.to,
        limit: 10,
      }) ?? Promise.reject(new Error("Report API is unavailable.")),
    enabled: apiClient !== null,
  });
  const definitionsQuery = useQuery({
    queryKey: [
      ...dashboardKeys.reports(identityKey),
      "definitions",
      definitionPage,
      definitionSize,
    ] as const,
    queryFn: () =>
      apiClient?.getReportDefinitions({ page: definitionPage, size: definitionSize }) ??
      Promise.reject(new Error("Report API is unavailable.")),
    enabled: apiClient !== null,
  });
  const catalogQuery = useQuery({
    queryKey: [
      ...dashboardKeys.reports(identityKey),
      "catalog",
      catalogObjectType ?? "default",
    ] as const,
    queryFn: () =>
      apiClient?.getReportCatalog(catalogObjectType) ??
      Promise.reject(new Error("Report catalog API is unavailable.")),
    enabled: apiClient !== null && editorSource !== undefined && canWrite,
  });
  const definitionQuery = useQuery({
    queryKey: [
      ...dashboardKeys.reports(identityKey),
      "definition",
      selectedDefinition?.id ?? 0,
    ] as const,
    queryFn: () => {
      if (apiClient === null || selectedDefinition === null) {
        return Promise.reject(new Error("Report definition API is unavailable."));
      }
      return apiClient.getReportDefinition(selectedDefinition.id);
    },
    enabled: apiClient !== null && selectedDefinition !== null,
  });
  const runMutation = useMutation({
    mutationFn: () => {
      if (apiClient === null || selectedDefinition === null) {
        return Promise.reject(new Error("报表暂时无法运行。"));
      }
      return apiClient.runReportDefinition(selectedDefinition.id, {
        from: date(runRange[0]),
        to: date(runRange[1]),
      });
    },
  });
  const saveMutation = useMutation({
    mutationFn: ({
      draft,
      source,
    }: {
      draft: ReportDefinitionDraft;
      source: ReportDefinition | null;
    }) => {
      if (apiClient === null) return Promise.reject(new Error("报表定义暂时无法保存。"));
      return source === null
        ? apiClient.createReportDefinition(toCreateRequest(draft, catalogQuery.data))
        : apiClient.updateReportDefinition(
            source.id,
            toUpdateRequest(draft, catalogQuery.data, source),
          );
    },
    onSuccess: () => {
      setEditorSource(undefined);
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.reports(identityKey) });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (source: ReportDefinition) => {
      if (apiClient === null) return Promise.reject(new Error("报表定义暂时无法删除。"));
      return apiClient.deleteReportDefinition(source.id, source.version);
    },
    onSuccess: () => {
      setSelectedDefinition(null);
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.reports(identityKey) });
    },
  });

  useEffect(() => {
    if (editorSource === null && catalogQuery.data && !form.getFieldValue("objectType")) {
      form.setFieldValue("objectType", catalogQuery.data.objectType);
    }
  }, [catalogQuery.data, editorSource, form]);

  function openEditor(source: ReportDefinition | null) {
    form.setFieldsValue(draftOf(source));
    setCatalogObjectType(source?.objectType);
    setEditorSource(source);
  }

  function changeObjectType(objectType: string) {
    form.setFieldsValue({
      dimensionFieldCode: undefined,
      filters: [],
      granularity: "",
      measures: [{ type: "COUNT" }],
      objectType,
      timeFieldCode: "",
    });
    setCatalogObjectType(objectType);
  }

  function updateFixedReportQuery(nextValues: Partial<ReportQuery>) {
    setSearchParams(
      withReportQuerySearchParams(searchParams, { ...fixedReportQuery, ...nextValues }),
    );
  }

  const core = coreQuery.data;
  const run = runMutation.data;
  const runColumns: ColumnsType<components["schemas"]["ReportRowResponse"]> = [
    { dataIndex: "periodStart", key: "periodStart", title: "周期" },
    {
      dataIndex: ["dimension", "label"],
      key: "dimension",
      title: "维度",
      render: (value) => value ?? "—",
    },
    ...(run?.columns.map((column) => ({
      dataIndex: ["values", column.key],
      key: column.key,
      render: (value: number | undefined) => (value === undefined ? "—" : String(value)),
      title: column.label,
    })) ?? []),
  ];
  const definitionColumns: ColumnsType<ReportDefinitionSummary> = [
    { dataIndex: "name", key: "name", title: "名称" },
    { dataIndex: "objectType", key: "objectType", title: "对象" },
    { dataIndex: "granularity", key: "granularity", title: "粒度" },
    { dataIndex: "measureCount", key: "measureCount", title: "指标数" },
    { dataIndex: "updatedTime", key: "updatedTime", title: "更新时间" },
    {
      key: "actions",
      title: "操作",
      render: (_, definition) => (
        <Button onClick={() => setSelectedDefinition(definition)}>查看</Button>
      ),
    },
  ];

  return (
    <RouteAuthority authority={authority.reportsRead}>
      <main>
        <Typography.Title level={2}>报表</Typography.Title>
        <Typography.Paragraph type="secondary">
          指标、范围、字段、维度、筛选和聚合均以当前服务端报表目录为准。
        </Typography.Paragraph>
        <section aria-label="固定报表筛选">
          <Space wrap>
            <Select
              aria-label="固定报表指标"
              options={reportMetrics.map((metric) => ({
                label: formatMetric(metric),
                value: metric,
              }))}
              value={fixedReportQuery.metric}
              onChange={(metric) => updateFixedReportQuery({ metric })}
            />
            <DatePicker.RangePicker
              allowClear={false}
              aria-label="固定报表日期范围"
              value={[dayjs(fixedReportQuery.from), dayjs(fixedReportQuery.to)]}
              onChange={(values) => {
                if (
                  values?.[0] === null ||
                  values?.[0] === undefined ||
                  values[1] === null ||
                  values[1] === undefined
                ) {
                  return;
                }
                updateFixedReportQuery({ from: date(values[0]), to: date(values[1]) });
              }}
            />
            <Select
              aria-label="固定趋势时间粒度"
              options={reportGranularities.map((granularity) => ({
                label: granularity === "DAY" ? "按日" : granularity === "WEEK" ? "按周" : "按月",
                value: granularity,
              }))}
              value={fixedReportQuery.granularity}
              onChange={(granularity) => updateFixedReportQuery({ granularity })}
            />
          </Space>
        </section>
        {[coreQuery, trendQuery, rankingQuery, definitionsQuery]
          .filter((query) => query.isError)
          .map((query, index) => (
            <QueryFailure key={index} error={query.error} />
          ))}
        <Tabs
          items={[
            {
              key: "core",
              label: "核心概览",
              children: core ? (
                <Row gutter={[16, 16]}>
                  {[
                    ["进行中商机", core.openOpportunityCount, core.openOpportunityEstimatedAmount],
                    ["赢单商机", core.wonOpportunityCount, core.wonOpportunityEstimatedAmount],
                    ["有效合同", core.activeContractCount, core.activeContractAmount],
                    ["已回款", core.receivableCount, core.receivableAmount],
                  ].map(([title, count, amount]) => (
                    <Col key={String(title)} lg={6} md={12} xs={24}>
                      <Card size="small" title={title}>
                        <Statistic title="数量" value={count} />
                        <Typography.Text type="secondary">
                          金额 {formatServerAmount(amount as number)}
                        </Typography.Text>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : (
                <Empty description="正在加载核心指标" />
              ),
            },
            {
              key: "trend",
              label: "指标趋势",
              children: (
                <Table
                  columns={[
                    { dataIndex: "periodStart", title: "周期" },
                    { dataIndex: "count", title: "数量" },
                    { dataIndex: "amount", title: "金额", render: formatServerAmount },
                  ]}
                  dataSource={trendQuery.data?.points ?? []}
                  pagination={false}
                  rowKey="periodStart"
                />
              ),
            },
            {
              key: "ranking",
              label: "负责人排行",
              children: (
                <Table
                  columns={[
                    { dataIndex: "rank", title: "排名" },
                    { dataIndex: "ownerActorId", title: "负责人" },
                    { dataIndex: "count", title: "数量" },
                    { dataIndex: "amount", title: "金额", render: formatServerAmount },
                  ]}
                  dataSource={rankingQuery.data?.items ?? []}
                  pagination={false}
                  rowKey="ownerActorId"
                />
              ),
            },
            {
              key: "definitions",
              label: "我的自定义报表",
              children: (
                <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
                  <ActionAuthority authority={authority.reportsWrite}>
                    <Button onClick={() => openEditor(null)} type="primary">
                      新建自定义报表
                    </Button>
                  </ActionAuthority>
                  <Table
                    columns={definitionColumns}
                    dataSource={definitionsQuery.data?.objectList ?? []}
                    loading={definitionsQuery.isLoading}
                    onChange={(pagination) => {
                      const next = new URLSearchParams(searchParams);
                      next.set("definitionPage", String(pagination.current ?? definitionPage));
                      next.set("definitionSize", String(pagination.pageSize ?? definitionSize));
                      setSearchParams(next);
                    }}
                    pagination={{
                      current: definitionsQuery.data?.pageNum ?? definitionPage,
                      pageSize: definitionsQuery.data?.pageSize ?? definitionSize,
                      total: definitionsQuery.data?.totalNum,
                    }}
                    rowKey="id"
                  />
                </Space>
              ),
            },
          ]}
        />
      </main>
      <DefinitionEditor
        catalog={catalogQuery.data}
        form={form}
        onCancel={() => setEditorSource(undefined)}
        onObjectTypeChange={changeObjectType}
        onSubmit={(draft) => saveMutation.mutate({ draft, source: editorSource ?? null })}
        open={editorSource !== undefined}
        source={editorSource ?? null}
        submitting={saveMutation.isPending}
      />
      <Drawer
        destroyOnHidden
        onClose={() => {
          runMutation.reset();
          setSelectedDefinition(null);
        }}
        open={selectedDefinition !== null}
        title="自定义报表详情"
        width={760}
      >
        {definitionQuery.isLoading ? <Spin /> : null}
        {definitionQuery.isError ? <QueryFailure error={definitionQuery.error} /> : null}
        {definitionQuery.data ? (
          <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="名称">{definitionQuery.data.name}</Descriptions.Item>
              <Descriptions.Item label="对象">{definitionQuery.data.objectType}</Descriptions.Item>
              <Descriptions.Item label="时间字段">
                {definitionQuery.data.timeFieldCode}
              </Descriptions.Item>
              <Descriptions.Item label="粒度">{definitionQuery.data.granularity}</Descriptions.Item>
              <Descriptions.Item label="维度">
                {definitionQuery.data.dimensionFieldCode ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="指标">
                {definitionQuery.data.measures.map((measure) => measure.key).join("、")}
              </Descriptions.Item>
            </Descriptions>
            <Space wrap>
              <DatePicker.RangePicker
                allowClear={false}
                onChange={(values) => {
                  if (values?.[0] && values[1]) setRunRange([values[0], values[1]]);
                }}
                value={runRange}
              />
              <Button
                loading={runMutation.isPending}
                onClick={() => runMutation.mutate()}
                type="primary"
              >
                运行
              </Button>
              <ActionAuthority authority={authority.reportsWrite}>
                <Button onClick={() => openEditor(definitionQuery.data)}>编辑</Button>
                <Popconfirm
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  okText="删除"
                  onConfirm={() => deleteMutation.mutate(definitionQuery.data)}
                  title="确认删除此自定义报表？"
                >
                  <Button danger loading={deleteMutation.isPending}>
                    删除
                  </Button>
                </Popconfirm>
              </ActionAuthority>
            </Space>
            {runMutation.isError ? <QueryFailure error={runMutation.error} /> : null}
            {deleteMutation.isError ? <QueryFailure error={deleteMutation.error} /> : null}
            {run ? (
              <Table
                columns={runColumns}
                dataSource={run.rows}
                pagination={false}
                rowKey={(row) => `${row.periodStart}-${row.dimension?.key ?? "all"}`}
                scroll={{ x: true }}
              />
            ) : null}
          </Space>
        ) : null}
      </Drawer>
    </RouteAuthority>
  );
}
