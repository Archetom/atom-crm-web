import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Form, Input, Modal, Select, Space, Spin, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
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

import { oaKeys } from "../model/query-keys";

type OaForm = components["schemas"]["OaFormResponse"];
type OaFormConfiguration = components["schemas"]["OaFormConfigurationOptionsResponse"];

interface OaFormDraft {
  approvalDefinitionId: number;
  code: string;
  description?: string;
  fieldCodes: string[];
  name: string;
}

type OaFormAction = { kind: "create" } | { formId: number; kind: "edit" | "status" | "delete" };

function updateSearch(current: URLSearchParams, page: number, size: number): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set("page", String(page));
  next.set("size", String(size));
  return next;
}

function toPageResult(response: components["schemas"]["OaFormPageResponse"]): PageResult<OaForm> {
  return {
    page: response.pageNum,
    size: response.pageSize,
    total: response.totalNum,
    items: response.objectList,
    meta: {},
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function requiredCodes(
  draft: OaFormDraft,
  configuration: OaFormConfiguration | undefined,
  existing: OaForm | null,
): Set<string> {
  const approval = configuration?.approvalDefinitions.find(
    (item) => item.id === draft.approvalDefinitionId,
  );
  const existingRequired = new Set(
    existing?.fields.filter((field) => field.required).map((field) => field.fieldCode) ?? [],
  );
  return new Set([
    ...(approval?.requiredFieldCodes ?? []),
    ...(configuration?.fields.filter((field) => field.required).map((field) => field.fieldCode) ??
      []),
    ...existingRequired,
  ]);
}

function toRequest(
  draft: OaFormDraft,
  configuration: OaFormConfiguration | undefined,
  existing: OaForm | null,
): components["schemas"]["OaFormCreateRequest"] {
  const mandatory = requiredCodes(draft, configuration, existing);
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    description: draft.description?.trim() || undefined,
    approvalDefinitionId: draft.approvalDefinitionId,
    fields: draft.fieldCodes.map((fieldCode, index) => ({
      fieldCode,
      required: mandatory.has(fieldCode),
      sortOrder: (index + 1) * 10,
    })),
  };
}

function FormDialog({
  configuration,
  error,
  form,
  loadingDetail,
  onCancel,
  onSubmit,
  open,
  source,
  submitting,
}: Readonly<{
  configuration: OaFormConfiguration | undefined;
  error: string | null;
  form: ReturnType<typeof Form.useForm<OaFormDraft>>[0];
  loadingDetail: boolean;
  onCancel: () => void;
  onSubmit: (draft: OaFormDraft) => void;
  open: boolean;
  source: OaForm | null | undefined;
  submitting: boolean;
}>) {
  const approvalId = Form.useWatch("approvalDefinitionId", form);
  const fieldCodes = Form.useWatch("fieldCodes", form) ?? [];
  const approval = configuration?.approvalDefinitions.find((item) => item.id === approvalId);
  const mustInclude = new Set([
    ...(approval?.requiredFieldCodes ?? []),
    ...(configuration?.fields.filter((field) => field.required).map((field) => field.fieldCode) ??
      []),
    ...(source?.fields.filter((field) => field.required).map((field) => field.fieldCode) ?? []),
  ]);
  const fieldOptions = configuration?.fields.map((field) => ({
    label: `${field.displayName}（${field.fieldType}）`,
    value: field.fieldCode,
    disabled: mustInclude.has(field.fieldCode) && !fieldCodes.includes(field.fieldCode),
  }));

  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ disabled: source === undefined, loading: submitting || loadingDetail }}
      okText={
        source === undefined
          ? loadingDetail
            ? "正在读取详情"
            : "无法编辑"
          : source === null
            ? "创建"
            : "保存"
      }
      onCancel={onCancel}
      onOk={() => {
        if (source !== undefined) form.submit();
      }}
      open={open}
      title={
        source === undefined
          ? loadingDetail
            ? "正在读取 OA 表单详情"
            : "OA 表单详情不可用"
          : source === null
            ? "新建 OA 表单"
            : "编辑 OA 表单"
      }
    >
      {source === undefined && loadingDetail ? (
        <div
          aria-label="正在加载 OA 表单详情"
          style={{ display: "grid", minHeight: 240, placeItems: "center" }}
        >
          <Spin size="large" />
        </div>
      ) : source !== undefined ? (
        <Form<OaFormDraft>
          form={form}
          layout="vertical"
          onFinish={onSubmit}
          onValuesChange={(changed) => {
            if (changed.approvalDefinitionId === undefined) return;
            const selected = configuration?.approvalDefinitions.find(
              (item) => item.id === changed.approvalDefinitionId,
            );
            const current = form.getFieldValue("fieldCodes") ?? [];
            const required = new Set([
              ...(selected?.requiredFieldCodes ?? []),
              ...(configuration?.fields
                .filter((field) => field.required)
                .map((field) => field.fieldCode) ?? []),
            ]);
            form.setFieldValue("fieldCodes", Array.from(new Set([...current, ...required])));
          }}
        >
          <Form.Item
            label="编码"
            name="code"
            rules={[{ required: true, message: "请输入表单编码" }]}
          >
            <Input disabled={source !== null} maxLength={100} />
          </Form.Item>
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: "请输入表单名称" }]}
          >
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea maxLength={1000} rows={3} />
          </Form.Item>
          <Form.Item
            label="审批定义"
            name="approvalDefinitionId"
            rules={[{ required: true, message: "请选择审批定义" }]}
          >
            <Select
              loading={configuration === undefined}
              options={configuration?.approvalDefinitions.map((item) => ({
                label:
                  item.requiredFieldCodes.length === 0
                    ? item.name
                    : `${item.name}（需包含：${item.requiredFieldCodes.join("、")}）`,
                value: item.id,
              }))}
              placeholder="选择服务端允许的审批定义"
            />
          </Form.Item>
          <Form.Item
            label="申请字段"
            name="fieldCodes"
            rules={[{ required: true, type: "array", min: 1, message: "至少选择一个申请字段" }]}
          >
            <Select
              loading={configuration === undefined}
              mode="multiple"
              options={fieldOptions}
              placeholder="选择服务端允许写入的字段"
            />
          </Form.Item>
          <Typography.Paragraph type="secondary">
            带有必填规则或审批路由条件的字段会由服务端目录自动保留；字段权限和审批有效性仍会在保存时复核。
          </Typography.Paragraph>
        </Form>
      ) : null}
      {error ? <Alert title={error} showIcon style={{ marginTop: 16 }} type="error" /> : null}
    </Modal>
  );
}

export function OaFormsPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formAction, setFormAction] = useState<OaFormAction | undefined>(undefined);
  const [form] = Form.useForm<OaFormDraft>();
  const search = searchParams.toString();
  const request = useMemo(() => {
    const params = new URLSearchParams(search);
    return normalizePageRequest({
      page: Number.parseInt(params.get("page") ?? "", 10),
      size: Number.parseInt(params.get("size") ?? "", 10),
    });
  }, [search]);
  const identityKey = authState?.identityKey ?? "pending";
  const canWrite = hasAuthority(authorization, authority.oaFormsWrite);
  const formsQuery = useQuery({
    queryKey: oaKeys.forms(identityKey, request.page, request.size),
    queryFn: () =>
      apiClient?.getOaForms(request) ?? Promise.reject(new Error("OA 表单暂时不可用。")),
    enabled: apiClient !== null,
  });
  const selectedFormId =
    formAction === undefined || formAction.kind === "create" ? null : formAction.formId;
  const selectedFormQuery = useQuery({
    queryKey: oaKeys.form(identityKey, selectedFormId ?? 0),
    queryFn: () =>
      apiClient === null || selectedFormId === null
        ? Promise.reject(new Error("OA 表单详情暂时不可用。"))
        : apiClient.getOaForm(selectedFormId),
    enabled: apiClient !== null && selectedFormId !== null,
  });
  const selectedForm = selectedFormQuery.data;
  const configurationQuery = useQuery({
    queryKey: oaKeys.formConfiguration(identityKey),
    queryFn: () =>
      apiClient?.getOaFormConfigurationOptions() ??
      Promise.reject(new Error("OA 表单配置目录暂时不可用。")),
    enabled: apiClient !== null && canWrite,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: oaKeys.all });
  const saveMutation = useMutation({
    mutationFn: async (draft: OaFormDraft) => {
      if (apiClient === null) throw new Error("OA 表单暂时不可用。");
      if (formAction?.kind === "create") {
        return apiClient.createOaForm(toRequest(draft, configurationQuery.data, null));
      }
      if (formAction?.kind !== "edit" || selectedForm === undefined) {
        throw new Error("OA 表单编辑状态已失效。");
      }
      return apiClient.updateOaForm(selectedForm.id, {
        ...toRequest(draft, configurationQuery.data, selectedForm),
        version: selectedForm.version,
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(oaKeys.form(identityKey, updated.id), updated);
      setFormAction(undefined);
      form.resetFields();
      refresh();
    },
  });
  const statusMutation = useMutation({
    mutationFn: async (source: OaForm) => {
      if (apiClient === null) throw new Error("OA 表单暂时不可用。");
      return apiClient.updateOaFormStatus(source.id, {
        version: source.version,
        status: source.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(oaKeys.form(identityKey, updated.id), updated);
      setFormAction(undefined);
      refresh();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (source: OaForm) => {
      if (apiClient === null) throw new Error("OA 表单暂时不可用。");
      await apiClient.deleteOaForm(source.id, source.version);
    },
    onSuccess: () => {
      setFormAction(undefined);
      refresh();
    },
  });
  const page: PageResult<OaForm> = formsQuery.data
    ? toPageResult(formsQuery.data)
    : { ...defaultPageRequest, items: [], meta: {}, total: null };
  useEffect(() => {
    if (formAction?.kind !== "edit" || selectedForm === undefined) return;
    form.setFieldsValue({
      code: selectedForm.code,
      name: selectedForm.name,
      description: selectedForm.description,
      approvalDefinitionId: selectedForm.approvalDefinitionId,
      fieldCodes: selectedForm.fields.map((field) => field.fieldCode),
    });
  }, [form, formAction, selectedForm]);
  const startAction = (action: OaFormAction) => {
    form.resetFields();
    saveMutation.reset();
    statusMutation.reset();
    deleteMutation.reset();
    setFormAction(action);
  };
  const closeAction = () => {
    form.resetFields();
    saveMutation.reset();
    statusMutation.reset();
    deleteMutation.reset();
    setFormAction(undefined);
  };
  const columns: ColumnsType<OaForm> = [
    { dataIndex: "name", key: "name", title: "表单名称" },
    { dataIndex: "code", key: "code", title: "编码" },
    { dataIndex: "approvalDefinitionName", key: "approvalDefinitionName", title: "审批定义" },
    {
      dataIndex: "status",
      key: "status",
      title: "状态",
      render: (value: OaForm["status"]) => <Tag>{value}</Tag>,
    },
    { dataIndex: "updatedTime", key: "updatedTime", title: "更新时间" },
    {
      key: "actions",
      title: "操作",
      render: (_, source) => (
        <ActionAuthority authority={authority.oaFormsWrite}>
          <Space wrap>
            <Button onClick={() => startAction({ formId: source.id, kind: "edit" })} size="small">
              编辑
            </Button>
            <Button onClick={() => startAction({ formId: source.id, kind: "status" })} size="small">
              变更状态
            </Button>
            <Button
              danger
              onClick={() => startAction({ formId: source.id, kind: "delete" })}
              size="small"
            >
              删除
            </Button>
          </Space>
        </ActionAuthority>
      ),
    },
  ];

  return (
    <RouteAuthority authority={authority.oaFormsRead}>
      <main>
        <Typography.Title level={2}>OA 表单</Typography.Title>
        <Typography.Paragraph type="secondary">
          表单字段和审批定义仅来自服务器按当前管理者权限过滤后的配置目录；启停、删除和并发版本始终由服务端复核。
        </Typography.Paragraph>
        <ActionAuthority authority={authority.oaFormsWrite}>
          <Button onClick={() => startAction({ kind: "create" })} type="primary">
            新建 OA 表单
          </Button>
        </ActionAuthority>
        {formsQuery.isError ? (
          <Alert
            title={errorMessage(formsQuery.error, "OA 表单暂时无法加载")}
            showIcon
            type="error"
          />
        ) : null}
        {configurationQuery.isError ? (
          <Alert
            title={errorMessage(configurationQuery.error, "OA 表单配置目录暂时无法加载")}
            showIcon
            type="error"
          />
        ) : null}
        <ResponsiveDataList
          columns={columns}
          loading={formsQuery.isLoading}
          onPageChange={(pageNumber, pageSize) =>
            setSearchParams(updateSearch(searchParams, pageNumber, pageSize))
          }
          page={page}
          renderMobileItem={(source) => (
            <Space orientation="vertical" size="small" style={{ display: "flex" }}>
              <Typography.Text strong>{source.name}</Typography.Text>
              <Typography.Text type="secondary">{source.code}</Typography.Text>
              <Typography.Text>
                {source.approvalDefinitionName ?? "未返回审批定义名称"}
              </Typography.Text>
              <Tag>{source.status}</Tag>
              <ActionAuthority authority={authority.oaFormsWrite}>
                <Space wrap>
                  <Button
                    onClick={() => startAction({ formId: source.id, kind: "edit" })}
                    size="small"
                  >
                    编辑
                  </Button>
                  <Button
                    onClick={() => startAction({ formId: source.id, kind: "status" })}
                    size="small"
                  >
                    变更状态
                  </Button>
                  <Button
                    danger
                    onClick={() => startAction({ formId: source.id, kind: "delete" })}
                    size="small"
                  >
                    删除
                  </Button>
                </Space>
              </ActionAuthority>
            </Space>
          )}
          rowKey={(source) => source.id}
        />
      </main>
      <FormDialog
        configuration={configurationQuery.data}
        error={
          formAction?.kind === "edit" && selectedFormQuery.isError
            ? errorMessage(selectedFormQuery.error, "OA 表单详情暂时无法加载")
            : saveMutation.isError
              ? errorMessage(saveMutation.error, "OA 表单保存失败")
              : null
        }
        form={form}
        loadingDetail={formAction?.kind === "edit" && selectedFormQuery.isLoading}
        onCancel={closeAction}
        onSubmit={(draft) => saveMutation.mutate(draft)}
        open={formAction?.kind === "create" || formAction?.kind === "edit"}
        source={formAction?.kind === "create" ? null : selectedForm}
        submitting={saveMutation.isPending}
      />
      <Modal
        cancelText="取消"
        okButtonProps={{
          disabled: selectedForm === undefined || selectedFormQuery.isError,
          loading: statusMutation.isPending,
        }}
        okText={selectedForm?.status === "ACTIVE" ? "停用" : "启用"}
        onCancel={closeAction}
        onOk={() => {
          if (selectedForm !== undefined) statusMutation.mutate(selectedForm);
        }}
        open={formAction?.kind === "status"}
        title="确认变更 OA 表单状态？"
      >
        {selectedFormQuery.isLoading ? (
          <div
            aria-label="正在加载 OA 表单详情"
            style={{ display: "grid", minHeight: 160, placeItems: "center" }}
          >
            <Spin size="large" />
          </div>
        ) : null}
        {selectedFormQuery.isError ? (
          <Alert
            title={errorMessage(selectedFormQuery.error, "OA 表单详情暂时无法加载")}
            showIcon
            type="error"
          />
        ) : null}
        {selectedForm !== undefined ? (
          <Typography.Paragraph>
            将{selectedForm.status === "ACTIVE" ? "停用" : "启用"}“{selectedForm.name}”（当前版本{" "}
            {selectedForm.version}）。
          </Typography.Paragraph>
        ) : null}
        {statusMutation.isError ? (
          <Alert
            title={errorMessage(statusMutation.error, "OA 表单状态更新失败")}
            showIcon
            type="error"
          />
        ) : null}
      </Modal>
      <Modal
        cancelText="取消"
        okButtonProps={{
          danger: true,
          disabled:
            selectedForm === undefined ||
            selectedForm.status !== "INACTIVE" ||
            selectedFormQuery.isError,
          loading: deleteMutation.isPending,
        }}
        okText="删除"
        onCancel={closeAction}
        onOk={() => {
          if (selectedForm?.status === "INACTIVE") deleteMutation.mutate(selectedForm);
        }}
        open={formAction?.kind === "delete"}
        title="确认删除 OA 表单？"
      >
        {selectedFormQuery.isLoading ? (
          <div
            aria-label="正在加载 OA 表单详情"
            style={{ display: "grid", minHeight: 160, placeItems: "center" }}
          >
            <Spin size="large" />
          </div>
        ) : null}
        {selectedFormQuery.isError ? (
          <Alert
            title={errorMessage(selectedFormQuery.error, "OA 表单详情暂时无法加载")}
            showIcon
            type="error"
          />
        ) : null}
        {selectedForm?.status === "INACTIVE" ? (
          <Typography.Paragraph>
            将删除“{selectedForm.name}”（当前版本 {selectedForm.version}
            ）。删除后不可恢复，服务端会再次校验引用关系。
          </Typography.Paragraph>
        ) : null}
        {selectedForm?.status === "ACTIVE" ? (
          <Alert
            title="当前表单仍处于启用状态，不能删除。请先停用后再试。"
            showIcon
            type="warning"
          />
        ) : null}
        {deleteMutation.isError ? (
          <Alert
            title={errorMessage(deleteMutation.error, "OA 表单删除失败")}
            showIcon
            type="error"
          />
        ) : null}
      </Modal>
    </RouteAuthority>
  );
}
