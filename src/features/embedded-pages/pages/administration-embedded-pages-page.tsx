import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useSearchParams } from "react-router";

import type { components, paths } from "~/api/generated/schema";
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

import { embeddedPageKeys } from "../model/query-keys";

type EmbeddedPage = components["schemas"]["EmbeddedPageResponse"];
type EmbeddedPageQuery = NonNullable<
  NonNullable<paths["/api/v1/embedded-pages"]["get"]>["parameters"]
>["query"];

interface EmbeddedPageFormValues {
  description?: string;
  name?: string;
  objectType?: string;
  platform?: string;
  sortOrder?: number;
  status?: string;
  urlTemplate?: string;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function normalizedText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function statusLabel(status: string): string {
  return status === "ACTIVE" ? "启用" : status === "INACTIVE" ? "停用" : status;
}

function EmbeddedPageEditorForm({
  configuration,
  editingPage,
  form,
  onFinish,
}: Readonly<{
  configuration: components["schemas"]["EmbeddedPageConfigurationOptionsResponse"] | undefined;
  editingPage: EmbeddedPage | null;
  form: ReturnType<typeof Form.useForm<EmbeddedPageFormValues>>[0];
  onFinish: (values: EmbeddedPageFormValues) => void;
}>) {
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        label="业务对象"
        name="objectType"
        rules={[{ required: true, message: "请选择业务对象" }]}
      >
        <Select
          disabled={editingPage !== null}
          loading={configuration === undefined}
          options={(configuration?.objectTypes ?? []).map((item) => ({
            label: item.displayName,
            value: item.code,
          }))}
        />
      </Form.Item>
      <Form.Item
        label="适用平台"
        name="platform"
        rules={[{ required: true, message: "请选择平台" }]}
      >
        <Select
          disabled={editingPage !== null}
          loading={configuration === undefined}
          options={(configuration?.platforms ?? []).map((value) => ({ label: value, value }))}
        />
      </Form.Item>
      <Form.Item
        label="名称"
        name="name"
        rules={[{ required: true, whitespace: true, message: "请输入名称" }, { max: 100 }]}
      >
        <Input maxLength={100} />
      </Form.Item>
      <Form.Item label="说明" name="description" rules={[{ max: 500 }]}>
        <Input.TextArea maxLength={500} rows={3} />
      </Form.Item>
      <Form.Item
        label="HTTPS URL 模板"
        name="urlTemplate"
        rules={[
          { required: true, whitespace: true, message: "请输入 HTTPS URL 模板" },
          {
            validator: async (_, value: unknown) => {
              if (typeof value === "string" && value.trim().startsWith("https://")) return;
              throw new Error("URL 模板必须以 https:// 开头");
            },
          },
          { max: 2048 },
        ]}
      >
        <Input maxLength={2048} />
      </Form.Item>
      <Form.Item label="排序" name="sortOrder" rules={[{ type: "number", min: 0, max: 10000 }]}>
        <InputNumber max={10000} min={0} style={{ width: "100%" }} />
      </Form.Item>
      {editingPage !== null ? (
        <Form.Item label="状态" name="status" rules={[{ required: true, message: "请选择状态" }]}>
          <Select
            loading={configuration === undefined}
            options={(configuration?.statuses ?? []).map((value) => ({
              label: statusLabel(value),
              value,
            }))}
          />
        </Form.Item>
      ) : null}
    </Form>
  );
}

export function AdministrationEmbeddedPagesPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<EmbeddedPage | null>(null);
  const [createForm] = Form.useForm<EmbeddedPageFormValues>();
  const [editForm] = Form.useForm<EmbeddedPageFormValues>();
  const identityKey = authState?.identityKey ?? "pending";
  const canRead = hasAuthority(authorization, authority.embeddedPagesRead);
  const canWrite = hasAuthority(authorization, authority.embeddedPagesWrite);
  const pagination = normalizePageRequest({
    page: Number.parseInt(searchParams.get("page") ?? "", 10),
    size: Number.parseInt(searchParams.get("size") ?? "", 10),
  });
  const query: EmbeddedPageQuery = {
    objectType: searchParams.get("objectType") ?? undefined,
    page: pagination.page,
    platform: searchParams.get("platform") ?? undefined,
    size: pagination.size,
    status: searchParams.get("status") ?? undefined,
  };
  const configurationQuery = useQuery({
    queryKey: embeddedPageKeys.configuration(identityKey),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("嵌入页面配置目录暂时不可用。"))
        : apiClient.getEmbeddedPageConfigurationOptions(),
    enabled: apiClient !== null && canRead,
  });
  const pagesQuery = useQuery({
    queryKey: embeddedPageKeys.list(identityKey, query),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("嵌入页面目录暂时不可用。"))
        : apiClient.getEmbeddedPages(query),
    enabled: apiClient !== null && canRead,
  });
  const invalidatePages = () => queryClient.invalidateQueries({ queryKey: embeddedPageKeys.all });
  const createMutation = useMutation({
    mutationFn: (request: components["schemas"]["EmbeddedPageCreateRequest"]) =>
      apiClient === null
        ? Promise.reject(new Error("嵌入页面暂时不可用。"))
        : apiClient.createEmbeddedPage(request),
    onSuccess: () => {
      void invalidatePages();
      closeCreate();
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      page,
      request,
    }: {
      page: EmbeddedPage;
      request: components["schemas"]["EmbeddedPageUpdateRequest"];
    }) =>
      apiClient === null
        ? Promise.reject(new Error("嵌入页面暂时不可用。"))
        : apiClient.updateEmbeddedPage(page.id, request),
    onSuccess: () => {
      void invalidatePages();
      closeEdit();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (page: EmbeddedPage) =>
      apiClient === null
        ? Promise.reject(new Error("嵌入页面暂时不可用。"))
        : apiClient.deleteEmbeddedPage(page.id, page.version),
    onSuccess: () => void invalidatePages(),
  });
  const configuration = configurationQuery.data;
  const pages = pagesQuery.data;
  const pageResult: PageResult<EmbeddedPage> = {
    ...defaultPageRequest,
    items: pages?.objectList ?? [],
    meta: {},
    page: pages?.pageNum ?? query.page ?? defaultPageRequest.page,
    size: pages?.pageSize ?? query.size ?? defaultPageRequest.size,
    total: pages?.totalNum ?? null,
  };
  const mutationError = createMutation.error ?? updateMutation.error ?? deleteMutation.error;

  function setFilter(name: "objectType" | "platform" | "status", value: string | undefined) {
    const next = new URLSearchParams(searchParams);
    if (value === undefined) next.delete(name);
    else next.set(name, value);
    next.set("page", "1");
    setSearchParams(next);
  }

  function setPage(page: number, size: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    next.set("size", String(size));
    setSearchParams(next);
  }

  function closeCreate() {
    createForm.resetFields();
    setCreateOpen(false);
  }

  function openCreate() {
    createMutation.reset();
    createForm.setFieldsValue({
      objectType: configuration?.objectTypes.at(0)?.code,
      platform: configuration?.platforms.at(0),
      sortOrder: 0,
    });
    setCreateOpen(true);
  }

  function closeEdit() {
    editForm.resetFields();
    setEditingPage(null);
  }

  function openEdit(page: EmbeddedPage) {
    updateMutation.reset();
    editForm.setFieldsValue({
      description: page.description ?? undefined,
      name: page.name,
      objectType: page.objectType,
      platform: page.platform,
      sortOrder: page.sortOrder,
      status: page.status,
      urlTemplate: page.urlTemplate,
    });
    setEditingPage(page);
  }

  function submitCreate(values: EmbeddedPageFormValues) {
    const name = normalizedText(values.name);
    const objectType = values.objectType;
    const platform = values.platform;
    const urlTemplate = normalizedText(values.urlTemplate);
    if (
      name === undefined ||
      objectType === undefined ||
      platform === undefined ||
      urlTemplate === undefined
    ) {
      return;
    }
    createMutation.mutate({
      description: normalizedText(values.description),
      name,
      objectType,
      platform,
      sortOrder: values.sortOrder ?? 0,
      urlTemplate,
    });
  }

  function submitEdit(values: EmbeddedPageFormValues) {
    if (editingPage === null) return;
    const name = normalizedText(values.name);
    const status = values.status;
    const urlTemplate = normalizedText(values.urlTemplate);
    if (name === undefined || status === undefined || urlTemplate === undefined) return;
    updateMutation.mutate({
      page: editingPage,
      request: {
        description: normalizedText(values.description),
        name,
        sortOrder: values.sortOrder ?? editingPage.sortOrder,
        status,
        urlTemplate,
        version: editingPage.version,
      },
    });
  }

  function renderActions(page: EmbeddedPage) {
    if (!canWrite) return "—";
    return (
      <Space wrap>
        <Button size="small" type="link" onClick={() => openEdit(page)}>
          编辑
        </Button>
        {page.status === "INACTIVE" ? (
          <Popconfirm
            cancelText="取消"
            description="仅停用状态的嵌入页面可删除；服务端会再次校验当前版本和状态。"
            okButtonProps={{ danger: true }}
            okText="确认删除"
            title={`删除嵌入页面“${page.name}”？`}
            onConfirm={() => deleteMutation.mutate(page)}
          >
            <Button
              danger
              loading={deleteMutation.isPending && deleteMutation.variables?.id === page.id}
              size="small"
              type="link"
            >
              删除
            </Button>
          </Popconfirm>
        ) : null}
      </Space>
    );
  }

  const columns: ColumnsType<EmbeddedPage> = [
    {
      dataIndex: "name",
      key: "name",
      render: (name, page) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{name}</Typography.Text>
          {page.description ? (
            <Typography.Text type="secondary">{page.description}</Typography.Text>
          ) : null}
        </Space>
      ),
      title: "名称",
    },
    { dataIndex: "objectType", key: "objectType", title: "业务对象" },
    { dataIndex: "platform", key: "platform", title: "平台" },
    {
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={status === "ACTIVE" ? "green" : "default"}>{statusLabel(status)}</Tag>
      ),
      title: "状态",
    },
    { dataIndex: "sortOrder", key: "sortOrder", title: "排序" },
    { key: "actions", render: (_, page) => renderActions(page), title: "操作" },
  ];

  return (
    <RouteAuthority authority={authority.embeddedPagesRead}>
      <main>
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <div>
            <Typography.Title level={2}>嵌入页面管理</Typography.Title>
            <Typography.Text type="secondary">
              业务对象、平台和状态均由服务端配置目录提供。创建始终为停用状态；激活后的 URL
              由服务端按当前记录渲染，浏览器不会替换模板变量。
            </Typography.Text>
          </div>
          <Space wrap>
            <Select
              allowClear
              loading={configurationQuery.isLoading}
              options={(configuration?.objectTypes ?? []).map((item) => ({
                label: item.displayName,
                value: item.code,
              }))}
              placeholder="业务对象"
              style={{ minWidth: 180 }}
              value={query.objectType}
              onChange={(value: string | undefined) => setFilter("objectType", value)}
            />
            <Select
              allowClear
              loading={configurationQuery.isLoading}
              options={(configuration?.platforms ?? []).map((value) => ({ label: value, value }))}
              placeholder="平台"
              style={{ minWidth: 130 }}
              value={query.platform}
              onChange={(value: string | undefined) => setFilter("platform", value)}
            />
            <Select
              allowClear
              loading={configurationQuery.isLoading}
              options={(configuration?.statuses ?? []).map((value) => ({
                label: statusLabel(value),
                value,
              }))}
              placeholder="状态"
              style={{ minWidth: 130 }}
              value={query.status}
              onChange={(value: string | undefined) => setFilter("status", value)}
            />
            <ActionAuthority authority={authority.embeddedPagesWrite}>
              <Button disabled={configuration === undefined} type="primary" onClick={openCreate}>
                新建嵌入页面
              </Button>
            </ActionAuthority>
          </Space>
          {configurationQuery.isError ? (
            <Alert
              title={errorMessage(configurationQuery.error, "嵌入页面配置目录暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          {pagesQuery.isError ? (
            <Alert
              title={errorMessage(pagesQuery.error, "嵌入页面目录暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          {mutationError ? (
            <Alert
              title={errorMessage(mutationError, "嵌入页面操作暂时无法完成")}
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            columns={columns}
            loading={pagesQuery.isLoading}
            page={pageResult}
            renderMobileItem={(page) => (
              <Card size="small" title={page.name}>
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text type="secondary">
                    {page.objectType} · {page.platform}
                  </Typography.Text>
                  <Space wrap>
                    <Tag color={page.status === "ACTIVE" ? "green" : "default"}>
                      {statusLabel(page.status)}
                    </Tag>
                    <Tag>排序 {page.sortOrder}</Tag>
                  </Space>
                  {page.description ? <Typography.Text>{page.description}</Typography.Text> : null}
                  {renderActions(page)}
                </Space>
              </Card>
            )}
            rowKey={(page) => page.id}
            onPageChange={setPage}
          />
        </Space>
      </main>
      <Modal
        confirmLoading={createMutation.isPending}
        destroyOnHidden
        okText="创建"
        open={createOpen}
        title="新建嵌入页面"
        onCancel={closeCreate}
        onOk={() => createForm.submit()}
      >
        <Typography.Paragraph type="secondary">
          仅可从服务端返回的业务对象和平台目录中选择。服务端会复核 URL
          模板、租户边界和初始停用状态。
        </Typography.Paragraph>
        <EmbeddedPageEditorForm
          configuration={configuration}
          editingPage={null}
          form={createForm}
          onFinish={submitCreate}
        />
      </Modal>
      <Modal
        confirmLoading={updateMutation.isPending}
        destroyOnHidden
        okText="保存"
        open={editingPage !== null}
        title={editingPage === null ? "编辑嵌入页面" : `编辑嵌入页面：${editingPage.name}`}
        onCancel={closeEdit}
        onOk={() => editForm.submit()}
      >
        <Typography.Paragraph type="secondary">
          保存会使用服务端返回的当前版本。停用后才能删除；所有状态转换仍由服务端最终裁决。
        </Typography.Paragraph>
        <EmbeddedPageEditorForm
          configuration={configuration}
          editingPage={editingPage}
          form={editForm}
          onFinish={submitEdit}
        />
      </Modal>
    </RouteAuthority>
  );
}
