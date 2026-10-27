import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { defaultPageRequest, type PageResult } from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";

import { fieldCustomizationKeys } from "../model/query-keys";

type BusinessObject = components["schemas"]["BusinessObjectResponse"];
type FieldDefinition = components["schemas"]["FieldDefinitionResponse"];
type FieldType = components["schemas"]["FieldCreateRequest"]["fieldType"];
type FieldAccessLevel = components["schemas"]["RoleFieldAccessRequest"]["accessLevel"];
type FieldMaskType = components["schemas"]["RoleFieldAccessRequest"]["maskType"];
type RoleFieldAccess = components["schemas"]["RoleFieldAccessResponse"];

interface FieldOptionValues {
  label?: string;
  value?: string;
}

interface FieldFormValues {
  description?: string;
  displayName?: string;
  displayOrder?: number;
  fieldType?: FieldType;
  options?: FieldOptionValues[];
  required?: boolean;
  searchable?: boolean;
  sectionName?: string;
  unique?: boolean;
}

interface LayoutDraft {
  columnWidths: Record<string, number>;
  hiddenCodes: string[];
  orderedCodes: string[];
  pinnedCodes: string[];
}

const fieldTypeLabels: Record<FieldType, string> = {
  ADDRESS: "地址",
  BOOLEAN: "布尔值",
  DATE: "日期",
  DATETIME: "日期时间",
  DECIMAL: "小数",
  DEPARTMENT: "部门",
  EMAIL: "邮箱",
  FILE: "文件",
  INTEGER: "整数",
  MULTI_SELECT: "多选",
  PHONE: "手机号",
  RELATION: "关联记录",
  SELECT: "单选",
  TEXT: "单行文本",
  TEXTAREA: "多行文本",
  URL: "链接",
  USER: "成员",
};

const fieldAccessLabels: Record<FieldAccessLevel, string> = {
  HIDDEN: "隐藏",
  READ: "只读",
  WRITE: "可编辑",
};

const fieldMaskLabels: Record<FieldMaskType, string> = {
  FULL: "完全脱敏",
  NONE: "不脱敏",
  PARTIAL: "部分脱敏",
};

const fieldTypeOptions = Object.entries(fieldTypeLabels).map(([value, label]) => ({
  label,
  value: value as FieldType,
}));

const fieldAccessOptions = Object.entries(fieldAccessLabels).map(([value, label]) => ({
  label,
  value: value as FieldAccessLevel,
}));

const fieldMaskOptions = Object.entries(fieldMaskLabels).map(([value, label]) => ({
  label,
  value: value as FieldMaskType,
}));

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function normalizedText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function usesOptions(fieldType: FieldType | undefined): boolean {
  return fieldType === "SELECT" || fieldType === "MULTI_SELECT";
}

function toLayoutDraft(layout: components["schemas"]["FieldLayoutResponse"]): LayoutDraft {
  return {
    columnWidths: { ...layout.columnWidths },
    hiddenCodes: [...layout.hiddenCodes],
    orderedCodes: [...layout.orderedCodes],
    pinnedCodes: [...layout.pinnedCodes],
  };
}

function orderedActiveCodes(fields: readonly FieldDefinition[], draft: LayoutDraft): string[] {
  const activeCodes = fields
    .filter((field) => field.status === "ACTIVE")
    .map((field) => field.code);
  const activeCodeSet = new Set(activeCodes);
  const ordered = draft.orderedCodes.filter((code) => activeCodeSet.has(code));
  const known = new Set(ordered);
  return [...ordered, ...activeCodes.filter((code) => !known.has(code))];
}

function FieldEditorForm({
  editingField,
  form,
  onFinish,
}: Readonly<{
  editingField: FieldDefinition | null;
  form: ReturnType<typeof Form.useForm<FieldFormValues>>[0];
  onFinish: (values: FieldFormValues) => void;
}>) {
  const fieldType = Form.useWatch("fieldType", form);
  const optionField = usesOptions(fieldType);

  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        label="字段名称"
        name="displayName"
        rules={[{ required: true, whitespace: true, message: "请输入字段名称" }, { max: 100 }]}
      >
        <Input maxLength={100} />
      </Form.Item>
      <Form.Item label="说明" name="description" rules={[{ max: 500 }]}>
        <Input.TextArea maxLength={500} rows={3} />
      </Form.Item>
      <Form.Item
        label="字段类型"
        name="fieldType"
        rules={[{ required: true, message: "请选择字段类型" }]}
      >
        <Select disabled={editingField !== null} options={fieldTypeOptions} />
      </Form.Item>
      <Space align="start" size="large" wrap>
        <Form.Item label="必填" name="required" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="可搜索" name="searchable" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="唯一值" name="unique" valuePropName="checked">
          <Switch disabled={editingField !== null} />
        </Form.Item>
      </Space>
      <Form.Item
        label="显示顺序"
        name="displayOrder"
        rules={[{ type: "number", min: 0, max: 10000 }]}
      >
        <InputNumber max={10000} min={0} style={{ width: "100%" }} />
      </Form.Item>
      <Form.Item label="分组" name="sectionName" rules={[{ max: 100 }]}>
        <Input maxLength={100} />
      </Form.Item>
      {optionField ? (
        <Form.List name="options">
          {(fields, { add, remove }) => (
            <Form.Item label="选项">
              <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                {fields.map((field) => (
                  <Space key={field.key} align="start" wrap>
                    <Form.Item
                      {...field}
                      name={[field.name, "value"]}
                      rules={[
                        { required: true, whitespace: true, message: "请输入存储值" },
                        { max: 100 },
                      ]}
                    >
                      <Input maxLength={100} placeholder="存储值" />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, "label"]}
                      rules={[
                        { required: true, whitespace: true, message: "请输入显示名称" },
                        { max: 100 },
                      ]}
                    >
                      <Input maxLength={100} placeholder="显示名称" />
                    </Form.Item>
                    <Button danger onClick={() => remove(field.name)} type="link">
                      移除
                    </Button>
                  </Space>
                ))}
                <Button onClick={() => add({})} type="dashed">
                  添加选项
                </Button>
              </Space>
            </Form.Item>
          )}
        </Form.List>
      ) : null}
    </Form>
  );
}

export function AdministrationFieldsPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutDraft, setLayoutDraft] = useState<LayoutDraft | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyRoleId, setPolicyRoleId] = useState<number | null>(null);
  const [policyDraft, setPolicyDraft] = useState<RoleFieldAccess[] | null>(null);
  const [createForm] = Form.useForm<FieldFormValues>();
  const [editForm] = Form.useForm<FieldFormValues>();
  const identityKey = authState?.identityKey ?? "pending";
  const canWriteFields = hasAuthority(authorization, authority.fieldsWrite);
  const canReadAuthorization = hasAuthority(authorization, authority.authorizationRead);
  const canReplacePolicy =
    canWriteFields &&
    hasAuthority(authorization, authority.authorizationWrite) &&
    hasAuthority(authorization, authority.authorizationAssign);
  const canViewPolicy = canWriteFields && canReadAuthorization;
  const objectsQuery = useQuery({
    queryKey: fieldCustomizationKeys.objects(identityKey),
    queryFn: () =>
      apiClient?.getCustomizableBusinessObjects() ??
      Promise.reject(new Error("Field object API is unavailable.")),
    enabled: apiClient !== null,
  });
  const objects = objectsQuery.data ?? [];
  const objectFromSearch = searchParams.get("object") ?? undefined;
  const selectedObject =
    objects.find((item) => item.code === objectFromSearch) ?? objects.at(0) ?? null;
  const objectType = selectedObject?.code;
  const fieldsQuery = useQuery({
    queryKey:
      objectType === undefined
        ? ["field-customization", identityKey, "definitions", "none"]
        : fieldCustomizationKeys.definitions(identityKey, objectType, canWriteFields),
    queryFn: () =>
      objectType === undefined || apiClient === null
        ? Promise.reject(new Error("Field definition API is unavailable."))
        : apiClient.listFieldDefinitions(objectType, canWriteFields),
    enabled: objectType !== undefined && apiClient !== null,
  });
  const layoutQuery = useQuery({
    queryKey:
      objectType === undefined
        ? ["field-customization", identityKey, "layout", "none"]
        : fieldCustomizationKeys.layout(identityKey, objectType),
    queryFn: () =>
      objectType === undefined || apiClient === null
        ? Promise.reject(new Error("Field layout API is unavailable."))
        : apiClient.getFieldLayoutDefinition(objectType),
    enabled: objectType !== undefined && apiClient !== null,
  });
  const rolesQuery = useQuery({
    queryKey: fieldCustomizationKeys.roles(identityKey),
    queryFn: () =>
      apiClient?.getTenantRoles({ page: 1, size: 200 }) ??
      Promise.reject(new Error("Role API is unavailable.")),
    enabled: canViewPolicy && apiClient !== null,
  });
  const policyQuery = useQuery({
    queryKey:
      policyRoleId === null || objectType === undefined
        ? ["field-customization", identityKey, "policy", "none"]
        : fieldCustomizationKeys.policy(identityKey, policyRoleId, objectType),
    queryFn: () =>
      policyRoleId === null || objectType === undefined || apiClient === null
        ? Promise.reject(new Error("Role field policy API is unavailable."))
        : apiClient.getRoleFieldPolicy(policyRoleId, objectType),
    enabled: policyOpen && policyRoleId !== null && objectType !== undefined && apiClient !== null,
  });
  const invalidateFields = () =>
    queryClient.invalidateQueries({ queryKey: fieldCustomizationKeys.all(identityKey) });
  const createMutation = useMutation({
    mutationFn: ({
      objectType: targetObjectType,
      request,
    }: {
      objectType: string;
      request: components["schemas"]["FieldCreateRequest"];
    }) =>
      apiClient?.createFieldDefinition(targetObjectType, request) ??
      Promise.reject(new Error("Field definition API is unavailable.")),
    onSuccess: () => {
      void invalidateFields();
      closeCreate();
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      field,
      request,
    }: {
      field: FieldDefinition;
      request: components["schemas"]["FieldUpdateRequest"];
    }) =>
      objectType === undefined || apiClient === null
        ? Promise.reject(new Error("Field definition API is unavailable."))
        : apiClient.updateFieldDefinition(objectType, field.id, request),
    onSuccess: () => {
      void invalidateFields();
      closeEdit();
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: (field: FieldDefinition) =>
      objectType === undefined || apiClient === null
        ? Promise.reject(new Error("Field definition API is unavailable."))
        : apiClient.deactivateFieldDefinition(objectType, field.id, field.version),
    onSuccess: () => void invalidateFields(),
  });
  const layoutMutation = useMutation({
    mutationFn: ({
      objectType: targetObjectType,
      request,
    }: {
      objectType: string;
      request: components["schemas"]["FieldLayoutUpdateRequest"];
    }) =>
      apiClient?.updateFieldLayoutDefinition(targetObjectType, request) ??
      Promise.reject(new Error("Field layout API is unavailable.")),
    onSuccess: () => {
      void invalidateFields();
      setLayoutOpen(false);
    },
  });
  const policyMutation = useMutation({
    mutationFn: ({
      roleId,
      objectType: targetObjectType,
      request,
    }: {
      roleId: number;
      objectType: string;
      request: components["schemas"]["RoleFieldPolicyReplaceRequest"];
    }) =>
      apiClient?.replaceRoleFieldPolicy(roleId, targetObjectType, request) ??
      Promise.reject(new Error("Role field policy API is unavailable.")),
    onSuccess: () => {
      void invalidateFields();
      closePolicy();
    },
  });

  const fields = fieldsQuery.data ?? [];
  const activeFields = fields.filter((field) => field.status === "ACTIVE");
  const currentLayoutDraft =
    layoutDraft ?? (layoutQuery.data === undefined ? null : toLayoutDraft(layoutQuery.data));
  const currentPolicyDraft = policyDraft ?? policyQuery.data?.accesses ?? null;
  const fieldPage: PageResult<FieldDefinition> = {
    ...defaultPageRequest,
    items: fields,
    meta: {},
    page: 1,
    size: Math.max(fields.length, 1),
    total: fields.length,
  };
  const policyRoleOptions = useMemo(
    () =>
      (rolesQuery.data?.objectList ?? [])
        .filter((role) => role.status === "ACTIVE" && role.systemKey === undefined)
        .map((role) => ({ label: role.name, value: role.id })),
    [rolesQuery.data],
  );
  const roleById = useMemo(
    () => new Map((rolesQuery.data?.objectList ?? []).map((role) => [role.id, role])),
    [rolesQuery.data],
  );
  const selectedPolicyRole = policyRoleId === null ? null : (roleById.get(policyRoleId) ?? null);
  const mutationError =
    createMutation.error ??
    updateMutation.error ??
    deactivateMutation.error ??
    layoutMutation.error ??
    policyMutation.error;

  function setSelectedObject(nextObjectType: string) {
    const next = new URLSearchParams(searchParams);
    next.set("object", nextObjectType);
    setSearchParams(next);
    setLayoutDraft(null);
  }

  function closeCreate() {
    createForm.resetFields();
    setCreateOpen(false);
  }

  function openCreate() {
    createForm.setFieldsValue({
      displayOrder: 0,
      required: false,
      searchable: true,
      unique: false,
    });
    setCreateOpen(true);
  }

  function closeEdit() {
    editForm.resetFields();
    setEditingField(null);
  }

  function openEdit(field: FieldDefinition) {
    editForm.setFieldsValue({
      description: field.description,
      displayName: field.displayName,
      displayOrder: field.displayOrder,
      fieldType: field.fieldType,
      options: field.options.map((option) => ({ label: option.label, value: option.value })),
      required: field.required,
      searchable: field.searchable,
      sectionName: field.sectionName,
      unique: field.unique,
    });
    setEditingField(field);
  }

  function closeLayout() {
    setLayoutOpen(false);
    setLayoutDraft(null);
  }

  function openLayout() {
    setLayoutDraft(null);
    setLayoutOpen(true);
  }

  function closePolicy() {
    setPolicyOpen(false);
    setPolicyRoleId(null);
    setPolicyDraft(null);
  }

  function openPolicy() {
    setPolicyDraft(null);
    setPolicyRoleId(policyRoleOptions.at(0)?.value ?? null);
    setPolicyOpen(true);
  }

  function normalizedOptions(
    values: FieldOptionValues[] | undefined,
  ): components["schemas"]["FieldOptionRequest"][] | null {
    const options = (values ?? []).map((option, index) => ({
      label: option.label?.trim() ?? "",
      order: index,
      value: option.value?.trim() ?? "",
    }));
    if (options.some((option) => !option.value || !option.label)) return null;
    const valuesSeen = new Set<string>();
    if (options.some((option) => valuesSeen.has(option.value) || !valuesSeen.add(option.value))) {
      return null;
    }
    return options;
  }

  function submitCreate(values: FieldFormValues) {
    const displayName = values.displayName?.trim();
    const fieldType = values.fieldType;
    if (!displayName || fieldType === undefined || objectType === undefined) {
      return;
    }
    const options = usesOptions(fieldType) ? normalizedOptions(values.options) : [];
    if (options === null) {
      createForm.setFields([{ name: "options", errors: ["请填写不重复的选项值和显示名称"] }]);
      return;
    }
    if (usesOptions(fieldType) && options.length === 0) {
      createForm.setFields([{ name: "options", errors: ["单选和多选字段至少需要一个选项"] }]);
      return;
    }
    createMutation.mutate({
      objectType,
      request: {
        description: normalizedText(values.description),
        displayName,
        displayOrder: values.displayOrder ?? 0,
        fieldType,
        options: usesOptions(fieldType) ? options : undefined,
        required: values.required === true,
        searchable: values.searchable !== false,
        sectionName: normalizedText(values.sectionName),
        unique: values.unique === true,
      },
    });
  }

  function submitEdit(values: FieldFormValues) {
    if (editingField === null) return;
    const displayName = values.displayName?.trim();
    if (!displayName) return;
    const options = usesOptions(editingField.fieldType) ? normalizedOptions(values.options) : [];
    if (options === null) {
      editForm.setFields([{ name: "options", errors: ["请填写不重复的选项值和显示名称"] }]);
      return;
    }
    if (usesOptions(editingField.fieldType) && options.length === 0) {
      editForm.setFields([{ name: "options", errors: ["单选和多选字段至少需要一个选项"] }]);
      return;
    }
    updateMutation.mutate({
      field: editingField,
      request: {
        description: normalizedText(values.description),
        displayName,
        displayOrder: values.displayOrder ?? editingField.displayOrder,
        options: usesOptions(editingField.fieldType) ? options : undefined,
        required: values.required === true,
        searchable: values.searchable !== false,
        sectionName: normalizedText(values.sectionName),
        version: editingField.version,
      },
    });
  }

  function moveLayoutCode(code: string, direction: -1 | 1) {
    if (currentLayoutDraft === null) return;
    const nextOrder = orderedActiveCodes(activeFields, currentLayoutDraft);
    const index = nextOrder.indexOf(code);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= nextOrder.length) return;
    [nextOrder[index], nextOrder[target]] = [nextOrder[target], nextOrder[index]];
    setLayoutDraft({ ...currentLayoutDraft, orderedCodes: nextOrder });
  }

  function toggleLayoutCode(
    property: "hiddenCodes" | "pinnedCodes",
    code: string,
    checked: boolean,
  ) {
    if (currentLayoutDraft === null) return;
    const next = new Set(currentLayoutDraft[property]);
    if (checked) next.add(code);
    else next.delete(code);
    setLayoutDraft({ ...currentLayoutDraft, [property]: [...next] });
  }

  function setLayoutWidth(code: string, value: number | null) {
    if (currentLayoutDraft === null) return;
    const columnWidths = { ...currentLayoutDraft.columnWidths };
    if (value === null) delete columnWidths[code];
    else columnWidths[code] = value;
    setLayoutDraft({ ...currentLayoutDraft, columnWidths });
  }

  function submitLayout() {
    if (objectType === undefined || layoutQuery.data === undefined || currentLayoutDraft === null) {
      return;
    }
    const activeCodes = orderedActiveCodes(activeFields, currentLayoutDraft);
    const activeCodeSet = new Set(activeCodes);
    const referencedCodes = [
      ...currentLayoutDraft.hiddenCodes,
      ...currentLayoutDraft.pinnedCodes,
      ...Object.keys(currentLayoutDraft.columnWidths),
    ];
    if (referencedCodes.some((code) => !activeCodeSet.has(code))) return;
    layoutMutation.mutate({
      objectType,
      request: {
        columnWidths: currentLayoutDraft.columnWidths,
        hiddenCodes: currentLayoutDraft.hiddenCodes.filter((code) => activeCodeSet.has(code)),
        orderedCodes: activeCodes,
        pinnedCodes: currentLayoutDraft.pinnedCodes.filter((code) => activeCodeSet.has(code)),
        version: layoutQuery.data.version ?? undefined,
      },
    });
  }

  function setPolicyAccess(
    fieldCode: string,
    update: Partial<Pick<RoleFieldAccess, "accessLevel" | "maskType">>,
  ) {
    if (currentPolicyDraft === null) return;
    setPolicyDraft(
      currentPolicyDraft.map((access) =>
        access.fieldCode === fieldCode ? { ...access, ...update } : access,
      ),
    );
  }

  function submitPolicy() {
    if (
      policyRoleId === null ||
      objectType === undefined ||
      policyQuery.data === undefined ||
      currentPolicyDraft === null
    ) {
      return;
    }
    const baselineCodes = new Set(policyQuery.data.accesses.map((access) => access.fieldCode));
    const draftCodes = new Set(currentPolicyDraft.map((access) => access.fieldCode));
    if (
      baselineCodes.size !== draftCodes.size ||
      [...baselineCodes].some((fieldCode) => !draftCodes.has(fieldCode))
    ) {
      return;
    }
    policyMutation.mutate({
      objectType,
      request: {
        accesses: currentPolicyDraft.map(({ accessLevel, fieldCode, maskType }) => ({
          accessLevel,
          fieldCode,
          maskType,
        })),
        version: policyQuery.data.version ?? undefined,
      },
      roleId: policyRoleId,
    });
  }

  function renderFieldActions(field: FieldDefinition) {
    if (!canWriteFields || field.builtin || field.status !== "ACTIVE") return "—";
    return (
      <Space wrap>
        <Button onClick={() => openEdit(field)} size="small" type="link">
          编辑
        </Button>
        <Popconfirm
          cancelText="取消"
          description="服务端会检查字段是否仍被布局、表单、审批、工作流或报表引用。"
          okButtonProps={{ danger: true }}
          okText="确认停用"
          onConfirm={() => deactivateMutation.mutate(field)}
          title={`停用字段“${field.displayName}”？`}
        >
          <Button
            danger
            loading={deactivateMutation.isPending && deactivateMutation.variables?.id === field.id}
            size="small"
            type="link"
          >
            停用
          </Button>
        </Popconfirm>
      </Space>
    );
  }

  const fieldColumns: ColumnsType<FieldDefinition> = [
    {
      dataIndex: "displayName",
      key: "displayName",
      render: (displayName, field) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{displayName}</Typography.Text>
          <Typography.Text type="secondary">{field.code}</Typography.Text>
        </Space>
      ),
      title: "字段",
    },
    {
      dataIndex: "fieldType",
      key: "fieldType",
      render: (fieldType: FieldType) => <Tag>{fieldTypeLabels[fieldType]}</Tag>,
      title: "类型",
    },
    {
      key: "settings",
      render: (_, field) => (
        <Space size={[4, 4]} wrap>
          <Tag color={field.builtin ? "default" : "blue"}>{field.builtin ? "系统" : "自定义"}</Tag>
          <Tag>{field.status === "ACTIVE" ? "启用" : "已停用"}</Tag>
          {field.required ? <Tag>必填</Tag> : null}
          {field.unique ? <Tag>唯一</Tag> : null}
          {field.searchable ? <Tag>可搜索</Tag> : null}
          {field.options.length > 0 ? <Tag>{field.options.length} 个选项</Tag> : null}
        </Space>
      ),
      title: "配置",
    },
    {
      dataIndex: "sectionName",
      key: "sectionName",
      render: (value) => value ?? "未分组",
      title: "分组",
    },
    { dataIndex: "displayOrder", key: "displayOrder", title: "顺序" },
    { key: "actions", render: (_, field) => renderFieldActions(field), title: "操作" },
  ];

  return (
    <RouteAuthority authority={authority.fieldsRead}>
      <main>
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <div>
            <Typography.Title level={2}>字段管理</Typography.Title>
            <Typography.Text type="secondary">
              对象、字段、布局和角色均来自服务端；浏览器始终提交当前读取到的完整布局或字段策略基线并携带版本号。
            </Typography.Text>
          </div>
          <Space wrap>
            <Select
              loading={objectsQuery.isLoading}
              options={objects.map((item: BusinessObject) => ({
                label: item.displayName,
                value: item.code,
              }))}
              placeholder="选择业务对象"
              style={{ minWidth: 220 }}
              value={selectedObject?.code}
              onChange={setSelectedObject}
            />
            <Button
              disabled={objectType === undefined || layoutQuery.isLoading}
              onClick={openLayout}
            >
              布局设置
            </Button>
            {canViewPolicy ? (
              <Button
                disabled={objectType === undefined || rolesQuery.isLoading}
                onClick={openPolicy}
              >
                角色字段策略
              </Button>
            ) : null}
            <ActionAuthority authority={authority.fieldsWrite}>
              <Button disabled={objectType === undefined} onClick={openCreate} type="primary">
                新建字段
              </Button>
            </ActionAuthority>
          </Space>
          {objectsQuery.isError ? (
            <Alert
              title={errorMessage(objectsQuery.error, "业务对象目录暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          {fieldsQuery.isError ? (
            <Alert
              title={errorMessage(fieldsQuery.error, "字段目录暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          {layoutQuery.isError ? (
            <Alert
              title={errorMessage(layoutQuery.error, "字段布局暂时无法加载")}
              showIcon
              type="warning"
            />
          ) : null}
          {canWriteFields && !canReadAuthorization ? (
            <Alert
              title="角色字段策略还需要角色读取权限；浏览器不会手输角色 ID。"
              showIcon
              type="info"
            />
          ) : null}
          {mutationError ? (
            <Alert
              title={errorMessage(mutationError, "字段操作暂时无法完成")}
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            columns={fieldColumns}
            loading={fieldsQuery.isLoading}
            onPageChange={() => undefined}
            page={fieldPage}
            renderMobileItem={(field) => (
              <Card size="small" title={field.displayName}>
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text type="secondary">{field.code}</Typography.Text>
                  <Space wrap>
                    <Tag>{fieldTypeLabels[field.fieldType]}</Tag>
                    <Tag color={field.builtin ? "default" : "blue"}>
                      {field.builtin ? "系统" : "自定义"}
                    </Tag>
                    <Tag>{field.status === "ACTIVE" ? "启用" : "已停用"}</Tag>
                  </Space>
                  {renderFieldActions(field)}
                </Space>
              </Card>
            )}
            rowKey={(field) => field.id}
          />
        </Space>
      </main>

      <Modal
        confirmLoading={createMutation.isPending}
        destroyOnHidden
        okText="创建"
        open={createOpen}
        title="新建字段"
        onCancel={closeCreate}
        onOk={() => createForm.submit()}
      >
        <Typography.Paragraph type="secondary">
          字段编码由服务端生成。字段类型仅可从当前 OpenAPI
          契约的枚举中选择，最终唯一性、可搜索性与选项约束仍由服务端复核。
        </Typography.Paragraph>
        <FieldEditorForm editingField={null} form={createForm} onFinish={submitCreate} />
      </Modal>

      <Modal
        confirmLoading={updateMutation.isPending}
        destroyOnHidden
        okText="保存"
        open={editingField !== null}
        title={editingField === null ? "编辑字段" : `编辑字段：${editingField.displayName}`}
        onCancel={closeEdit}
        onOk={() => editForm.submit()}
      >
        <Typography.Paragraph type="secondary">
          字段类型和唯一性创建后不能变更；已有选项值只能保留或新增，避免破坏已保存的数据。
        </Typography.Paragraph>
        <FieldEditorForm editingField={editingField} form={editForm} onFinish={submitEdit} />
      </Modal>

      <Drawer
        destroyOnHidden
        open={layoutOpen}
        title={selectedObject === null ? "字段布局" : `${selectedObject.displayName}：字段布局`}
        width={760}
        onClose={closeLayout}
      >
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <Typography.Text type="secondary">
            布局属于当前登录成员。保存时会带上服务器返回的版本；未在已有顺序中的新字段会追加到末尾，避免被遗漏。
          </Typography.Text>
          {currentLayoutDraft === null ? (
            <Alert title="字段布局正在加载" showIcon type="info" />
          ) : (
            <Space orientation="vertical" size="small" style={{ display: "flex" }}>
              {orderedActiveCodes(activeFields, currentLayoutDraft).map(
                (fieldCode, index, codes) => {
                  const field = activeFields.find((item) => item.code === fieldCode);
                  if (field === undefined) return null;
                  return (
                    <Card key={fieldCode} size="small">
                      <Space align="center" wrap>
                        <Typography.Text strong>{field.displayName}</Typography.Text>
                        <Typography.Text type="secondary">{fieldCode}</Typography.Text>
                        <Button
                          disabled={index === 0}
                          onClick={() => moveLayoutCode(fieldCode, -1)}
                          size="small"
                        >
                          上移
                        </Button>
                        <Button
                          disabled={index === codes.length - 1}
                          onClick={() => moveLayoutCode(fieldCode, 1)}
                          size="small"
                        >
                          下移
                        </Button>
                        <Checkbox
                          checked={currentLayoutDraft.hiddenCodes.includes(fieldCode)}
                          onChange={(event) =>
                            toggleLayoutCode("hiddenCodes", fieldCode, event.target.checked)
                          }
                        >
                          隐藏
                        </Checkbox>
                        <Checkbox
                          checked={currentLayoutDraft.pinnedCodes.includes(fieldCode)}
                          onChange={(event) =>
                            toggleLayoutCode("pinnedCodes", fieldCode, event.target.checked)
                          }
                        >
                          固定
                        </Checkbox>
                        <Tooltip title="留空使用默认列宽">
                          <InputNumber
                            min={1}
                            placeholder="列宽"
                            value={currentLayoutDraft.columnWidths[fieldCode]}
                            onChange={(value) => setLayoutWidth(fieldCode, value)}
                          />
                        </Tooltip>
                      </Space>
                    </Card>
                  );
                },
              )}
              {activeFields.length === 0 ? (
                <Alert title="当前对象没有启用字段。" showIcon type="info" />
              ) : null}
              <Button
                disabled={activeFields.length === 0}
                loading={layoutMutation.isPending}
                type="primary"
                onClick={submitLayout}
              >
                保存布局
              </Button>
            </Space>
          )}
        </Space>
      </Drawer>

      <Drawer
        destroyOnHidden
        open={policyOpen}
        title="角色字段策略"
        width={860}
        onClose={closePolicy}
      >
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <Typography.Text type="secondary">
            角色和字段访问项全部来自服务端。保存策略时提交完整访问项集合，并使用策略的当前版本；系统角色不会出现在可编辑列表中。
          </Typography.Text>
          <Select
            loading={rolesQuery.isLoading}
            options={policyRoleOptions}
            placeholder="选择自定义角色"
            value={policyRoleId ?? undefined}
            onChange={(roleId: number) => {
              setPolicyDraft(null);
              setPolicyRoleId(roleId);
            }}
          />
          {rolesQuery.isError ? <Alert title="角色目录暂时无法加载" showIcon type="error" /> : null}
          {policyQuery.isError ? (
            <Alert
              title={errorMessage(policyQuery.error, "角色字段策略暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          {selectedPolicyRole === null && policyRoleOptions.length === 0 ? (
            <Alert title="没有可管理的启用自定义角色。" showIcon type="info" />
          ) : null}
          {currentPolicyDraft === null ? (
            policyRoleId !== null ? (
              <Alert title="字段策略正在加载" showIcon type="info" />
            ) : null
          ) : (
            <ResponsiveDataList
              columns={[
                { dataIndex: "displayName", key: "displayName", title: "字段" },
                { dataIndex: "fieldCode", key: "fieldCode", title: "编码" },
                {
                  dataIndex: "accessLevel",
                  key: "accessLevel",
                  render: (value: FieldAccessLevel, access: RoleFieldAccess) => (
                    <Select
                      aria-label={`${access.displayName} 的访问级别`}
                      disabled={!canReplacePolicy}
                      options={fieldAccessOptions}
                      value={value}
                      onChange={(accessLevel: FieldAccessLevel) =>
                        setPolicyAccess(access.fieldCode, { accessLevel })
                      }
                    />
                  ),
                  title: "访问级别",
                },
                {
                  dataIndex: "maskType",
                  key: "maskType",
                  render: (value: FieldMaskType, access: RoleFieldAccess) => (
                    <Select
                      aria-label={`${access.displayName} 的脱敏方式`}
                      disabled={!canReplacePolicy}
                      options={fieldMaskOptions}
                      value={value}
                      onChange={(maskType: FieldMaskType) =>
                        setPolicyAccess(access.fieldCode, { maskType })
                      }
                    />
                  ),
                  title: "脱敏",
                },
              ]}
              loading={policyQuery.isLoading}
              onPageChange={() => undefined}
              page={{
                ...defaultPageRequest,
                items: currentPolicyDraft,
                meta: {},
                page: 1,
                size: Math.max(currentPolicyDraft.length, 1),
                total: currentPolicyDraft.length,
              }}
              renderMobileItem={(access) => (
                <Card size="small" title={access.displayName}>
                  <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                    <Typography.Text type="secondary">{access.fieldCode}</Typography.Text>
                    <Select
                      aria-label={`${access.displayName} 的访问级别`}
                      disabled={!canReplacePolicy}
                      options={fieldAccessOptions}
                      value={access.accessLevel}
                      onChange={(accessLevel: FieldAccessLevel) =>
                        setPolicyAccess(access.fieldCode, { accessLevel })
                      }
                    />
                    <Select
                      aria-label={`${access.displayName} 的脱敏方式`}
                      disabled={!canReplacePolicy}
                      options={fieldMaskOptions}
                      value={access.maskType}
                      onChange={(maskType: FieldMaskType) =>
                        setPolicyAccess(access.fieldCode, { maskType })
                      }
                    />
                  </Space>
                </Card>
              )}
              rowKey={(access) => access.fieldCode}
            />
          )}
          {currentPolicyDraft !== null && canReplacePolicy ? (
            <Button loading={policyMutation.isPending} type="primary" onClick={submitPolicy}>
              保存字段策略
            </Button>
          ) : null}
          {currentPolicyDraft !== null && !canReplacePolicy ? (
            <Alert
              title="保存策略还需要角色写入与角色分配权限；当前仅可查看。"
              showIcon
              type="info"
            />
          ) : null}
        </Space>
      </Drawer>
    </RouteAuthority>
  );
}
