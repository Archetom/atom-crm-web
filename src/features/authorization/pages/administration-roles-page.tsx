import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
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
import {
  defaultPageRequest,
  normalizePageRequest,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";

import { authorizationKeys } from "../model/query-keys";

type Role = components["schemas"]["TenantRoleResponse"];
type RoleAssignment = components["schemas"]["RoleAssignmentResponse"];

interface RoleCreateValues {
  description?: string;
  grantCodes?: string[];
  name?: string;
}

interface RoleEditValues {
  description?: string;
  name?: string;
  status?: string;
}

interface RoleGrantValues {
  grantCodes?: string[];
}

interface RoleCopyValues {
  name?: string;
}

interface RoleAssignmentValues {
  actorIds?: number[];
}

function updateSearch(
  current: URLSearchParams,
  update: Record<string, number | string | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  return next;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function normalizedDescription(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function AdministrationRolesPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [grantingRole, setGrantingRole] = useState<Role | null>(null);
  const [copyingRole, setCopyingRole] = useState<Role | null>(null);
  const [assignmentRole, setAssignmentRole] = useState<Role | null>(null);
  const [assignmentPageRequest, setAssignmentPageRequest] = useState({ page: 1, size: 20 });
  const [memberKeyword, setMemberKeyword] = useState("");
  const [createForm] = Form.useForm<RoleCreateValues>();
  const [editForm] = Form.useForm<RoleEditValues>();
  const [grantForm] = Form.useForm<RoleGrantValues>();
  const [copyForm] = Form.useForm<RoleCopyValues>();
  const [assignmentForm] = Form.useForm<RoleAssignmentValues>();
  const serializedSearch = searchParams.toString();
  const request = useMemo(() => {
    const current = new URLSearchParams(serializedSearch);
    const page = normalizePageRequest({
      page: Number.parseInt(current.get("page") ?? "", 10),
      size: Number.parseInt(current.get("size") ?? "", 10),
    });
    const keyword = current.get("keyword")?.trim();
    return { ...page, keyword: keyword || undefined };
  }, [serializedSearch]);
  const identityKey = authState?.identityKey ?? "pending";
  const canWrite = hasAuthority(authorization, authority.authorizationWrite);
  const canAssign = hasAuthority(authorization, authority.authorizationAssign);
  const canManageRoles = canWrite && canAssign;
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const rolesQuery = useQuery({
    queryKey: authorizationKeys.roles(identityKey, request),
    queryFn: () =>
      apiClient?.getTenantRoles(request) ?? Promise.reject(new Error("Role API is unavailable.")),
    enabled: apiClient !== null,
  });
  const capabilitiesQuery = useQuery({
    queryKey: authorizationKeys.capabilities(identityKey),
    queryFn: () =>
      apiClient?.getAuthorizationCapabilities() ??
      Promise.reject(new Error("Capability API is unavailable.")),
    enabled: apiClient !== null && canManageRoles,
  });
  const assignmentsQuery = useQuery({
    queryKey:
      assignmentRole === null
        ? ["authorization-management", "assignments", "none"]
        : authorizationKeys.assignments(identityKey, assignmentRole.id, assignmentPageRequest),
    queryFn: () =>
      assignmentRole === null || apiClient === null
        ? Promise.reject(new Error("Role assignment API is unavailable."))
        : apiClient.getTenantRoleAssignments(assignmentRole.id, assignmentPageRequest),
    enabled: assignmentRole !== null && apiClient !== null,
  });
  const memberQuery = useQuery({
    queryKey: ["member-selector", "role-assignment", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient?.getVisibleMembers({
        keyword: memberKeyword.trim() || undefined,
        page: 1,
        size: 50,
      }) ?? Promise.reject(new Error("Member directory is unavailable.")),
    enabled: assignmentRole !== null && apiClient !== null && canAssign && canReadOrganization,
  });
  const invalidateRoles = () =>
    queryClient.invalidateQueries({ queryKey: authorizationKeys.all(identityKey) });
  const createMutation = useMutation({
    mutationFn: (requestBody: components["schemas"]["RoleCreateRequest"]) =>
      apiClient?.createTenantRole(requestBody) ??
      Promise.reject(new Error("Role API is unavailable.")),
    onSuccess: () => {
      void invalidateRoles();
      closeCreate();
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      role,
      requestBody,
    }: {
      role: Role;
      requestBody: components["schemas"]["RoleUpdateRequest"];
    }) =>
      apiClient?.updateTenantRole(role.id, requestBody) ??
      Promise.reject(new Error("Role API is unavailable.")),
    onSuccess: () => {
      void invalidateRoles();
      closeEdit();
    },
  });
  const grantsMutation = useMutation({
    mutationFn: ({
      role,
      requestBody,
    }: {
      role: Role;
      requestBody: components["schemas"]["RoleGrantReplaceRequest"];
    }) =>
      apiClient?.replaceTenantRoleGrants(role.id, requestBody) ??
      Promise.reject(new Error("Role API is unavailable.")),
    onSuccess: () => {
      void invalidateRoles();
      closeGrants();
    },
  });
  const copyMutation = useMutation({
    mutationFn: ({ role, name }: { role: Role; name: string }) =>
      apiClient?.copyTenantRole(role.id, { name }) ??
      Promise.reject(new Error("Role API is unavailable.")),
    onSuccess: () => {
      void invalidateRoles();
      closeCopy();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (role: Role) =>
      apiClient?.deleteTenantRole(role.id, role.version) ??
      Promise.reject(new Error("Role API is unavailable.")),
    onSuccess: () => void invalidateRoles(),
  });
  const assignMutation = useMutation({
    mutationFn: ({ role, actorIds }: { role: Role; actorIds: number[] }) =>
      apiClient?.assignTenantRole(role.id, { actorIds }) ??
      Promise.reject(new Error("Role API is unavailable.")),
    onSuccess: () => {
      void invalidateRoles();
      void assignmentsQuery.refetch();
      assignmentForm.resetFields();
    },
  });
  const removeAssignmentMutation = useMutation({
    mutationFn: ({ role, actorId }: { role: Role; actorId: number }) =>
      apiClient?.removeTenantRoleAssignment(role.id, actorId) ??
      Promise.reject(new Error("Role API is unavailable.")),
    onSuccess: () => {
      void invalidateRoles();
      void assignmentsQuery.refetch();
    },
  });

  const capabilityByCode = useMemo(
    () =>
      new Map((capabilitiesQuery.data ?? []).map((capability) => [capability.code, capability])),
    [capabilitiesQuery.data],
  );
  const rolePage: PageResult<Role> = rolesQuery.data
    ? {
        items: rolesQuery.data.objectList,
        meta: {},
        page: rolesQuery.data.pageNum,
        size: rolesQuery.data.pageSize,
        total: rolesQuery.data.totalNum < 0 ? null : rolesQuery.data.totalNum,
      }
    : { ...defaultPageRequest, items: [], meta: {}, total: null };
  const assignmentPage: PageResult<RoleAssignment> = assignmentsQuery.data
    ? {
        items: assignmentsQuery.data.objectList,
        meta: {},
        page: assignmentsQuery.data.pageNum,
        size: assignmentsQuery.data.pageSize,
        total: assignmentsQuery.data.totalNum < 0 ? null : assignmentsQuery.data.totalNum,
      }
    : { ...defaultPageRequest, items: [], meta: {}, total: null };

  function closeCreate() {
    createForm.resetFields();
    setCreateOpen(false);
  }

  function closeEdit() {
    editForm.resetFields();
    setEditingRole(null);
  }

  function closeGrants() {
    grantForm.resetFields();
    setGrantingRole(null);
  }

  function closeCopy() {
    copyForm.resetFields();
    setCopyingRole(null);
  }

  function closeAssignments() {
    assignmentForm.resetFields();
    setAssignmentRole(null);
    setAssignmentPageRequest({ page: 1, size: 20 });
    setMemberKeyword("");
  }

  function openEdit(role: Role) {
    editForm.setFieldsValue({
      description: role.description,
      name: role.name,
      status: role.status,
    });
    setEditingRole(role);
  }

  function openGrants(role: Role) {
    if (role.grants.some((grant) => !capabilityByCode.has(grant.authorityCode))) return;
    grantForm.setFieldsValue({ grantCodes: role.grants.map((grant) => grant.authorityCode) });
    setGrantingRole(role);
  }

  function openCopy(role: Role) {
    copyForm.setFieldsValue({ name: `${role.name} 副本` });
    setCopyingRole(role);
  }

  function openAssignments(role: Role) {
    setAssignmentPageRequest({ page: 1, size: 20 });
    setAssignmentRole(role);
  }

  function setPage(page: number, size: number) {
    setSearchParams(updateSearch(searchParams, { page, size }));
  }

  function setKeyword(keyword: string) {
    setSearchParams(updateSearch(searchParams, { keyword: keyword.trim() || undefined, page: 1 }));
  }

  function submitCreate(values: RoleCreateValues) {
    const name = values.name?.trim();
    const grantCodes = values.grantCodes ?? [];
    if (!name || grantCodes.some((code) => !capabilityByCode.has(code))) return;
    createMutation.mutate({
      description: normalizedDescription(values.description),
      grants: grantCodes.map((authorityCode) => ({ authorityCode })),
      name,
    });
  }

  function submitEdit(values: RoleEditValues) {
    if (editingRole === null || !values.name?.trim() || !values.status) return;
    updateMutation.mutate({
      requestBody: {
        description: normalizedDescription(values.description),
        name: values.name.trim(),
        status: values.status,
        version: editingRole.version,
      },
      role: editingRole,
    });
  }

  function submitGrants(values: RoleGrantValues) {
    if (grantingRole === null) return;
    const grantCodes = values.grantCodes ?? [];
    if (grantCodes.some((code) => !capabilityByCode.has(code))) return;
    const existingScopes = new Map(
      grantingRole.grants.map((grant) => [grant.authorityCode, grant.dataScope]),
    );
    grantsMutation.mutate({
      requestBody: {
        grants: grantCodes.map((authorityCode) => ({
          authorityCode,
          dataScope: existingScopes.get(authorityCode),
        })),
        version: grantingRole.version,
      },
      role: grantingRole,
    });
  }

  function submitCopy(values: RoleCopyValues) {
    const name = values.name?.trim();
    if (copyingRole === null || !name) return;
    copyMutation.mutate({ name, role: copyingRole });
  }

  function submitAssignments(values: RoleAssignmentValues) {
    if (assignmentRole === null || values.actorIds === undefined || values.actorIds.length === 0)
      return;
    assignMutation.mutate({ actorIds: values.actorIds, role: assignmentRole });
  }

  function renderRoleActions(role: Role) {
    const editableGrants = role.grants.every((grant) => capabilityByCode.has(grant.authorityCode));
    return (
      <Space wrap>
        <ActionAuthority authority={authority.authorizationAssign}>
          <Button onClick={() => openAssignments(role)} size="small" type="link">
            成员分配
          </Button>
        </ActionAuthority>
        {canManageRoles && role.systemKey === undefined ? (
          <>
            <Button onClick={() => openEdit(role)} size="small" type="link">
              编辑
            </Button>
            <Button
              disabled={!editableGrants}
              onClick={() => openGrants(role)}
              size="small"
              type="link"
            >
              授权
            </Button>
            <Button onClick={() => openCopy(role)} size="small" type="link">
              复制
            </Button>
            <Popconfirm
              cancelText="取消"
              description="服务端会重新确认角色可委派、未分配且版本一致。"
              okButtonProps={{ danger: true }}
              okText="确认删除"
              onConfirm={() => deleteMutation.mutate(role)}
              title={`删除角色“${role.name}”？`}
            >
              <Button
                danger
                loading={deleteMutation.isPending && deleteMutation.variables?.id === role.id}
                size="small"
                type="link"
              >
                删除
              </Button>
            </Popconfirm>
          </>
        ) : null}
      </Space>
    );
  }

  const columns: ColumnsType<Role> = [
    {
      dataIndex: "name",
      key: "name",
      render: (name, role) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{name}</Typography.Text>
          <Typography.Text type="secondary">{role.description ?? "未填写描述"}</Typography.Text>
        </Space>
      ),
      title: "角色",
    },
    { dataIndex: "status", key: "status", render: (status) => <Tag>{status}</Tag>, title: "状态" },
    {
      dataIndex: "grants",
      key: "grants",
      render: (grants: Role["grants"]) => `${grants.length} 项授权`,
      title: "授权",
    },
    {
      key: "actions",
      title: "操作",
      render: (_, role) => renderRoleActions(role),
    },
  ];
  const memberOptions = (memberQuery.data ?? []).map((member) => ({
    label: member.displayName,
    value: member.actorId,
  }));
  const mutationError =
    createMutation.error ??
    updateMutation.error ??
    grantsMutation.error ??
    copyMutation.error ??
    deleteMutation.error ??
    assignMutation.error ??
    removeAssignmentMutation.error;

  return (
    <RouteAuthority authority={authority.authorizationRead}>
      <main>
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <div>
            <Typography.Title level={2}>角色与权限</Typography.Title>
            <Typography.Text type="secondary">
              角色、可分配授权和成员范围均由服务端复核；浏览器只提交服务端能力目录中选定的授权码。
            </Typography.Text>
          </div>
          <Space wrap>
            <Input.Search
              allowClear
              defaultValue={request.keyword}
              key={request.keyword ?? ""}
              onSearch={setKeyword}
              placeholder="搜索角色名称"
            />
            {canManageRoles ? (
              <Button onClick={() => setCreateOpen(true)} type="primary">
                新建角色
              </Button>
            ) : null}
          </Space>
          {rolesQuery.isError ? (
            <Alert
              title={errorMessage(rolesQuery.error, "角色目录暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          {capabilitiesQuery.isError ? (
            <Alert
              title="可分配能力目录暂时无法加载，角色授权编辑已关闭。"
              showIcon
              type="warning"
            />
          ) : null}
          {mutationError ? (
            <Alert
              title={errorMessage(mutationError, "角色操作暂时无法完成")}
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            columns={columns}
            loading={rolesQuery.isLoading}
            onPageChange={setPage}
            page={rolePage}
            renderMobileItem={(role) => (
              <Card size="small" title={role.name}>
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{role.description ?? "未填写描述"}</Typography.Text>
                  <Tag>{role.status}</Tag>
                  <Typography.Text type="secondary">{role.grants.length} 项授权</Typography.Text>
                  {renderRoleActions(role)}
                </Space>
              </Card>
            )}
            rowKey={(role) => role.id}
          />
        </Space>
      </main>

      <Modal
        confirmLoading={createMutation.isPending}
        destroyOnHidden
        okText="创建"
        open={createOpen}
        title="新建角色"
        onCancel={closeCreate}
        onOk={() => createForm.submit()}
      >
        <Typography.Paragraph type="secondary">
          授权码只能从服务端下发的可委派能力目录选择；数据范围由服务端既有策略决定，本页不会手填或猜测范围值。
        </Typography.Paragraph>
        <Form form={createForm} layout="vertical" onFinish={submitCreate}>
          <Form.Item
            label="角色名称"
            name="name"
            rules={[{ required: true, whitespace: true, message: "请输入角色名称" }, { max: 100 }]}
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item label="描述" name="description" rules={[{ max: 500 }]}>
            <Input.TextArea maxLength={500} rows={3} />
          </Form.Item>
          <Form.Item label="授权" name="grantCodes">
            <Select
              disabled={capabilitiesQuery.isLoading || capabilitiesQuery.isError}
              mode="multiple"
              options={(capabilitiesQuery.data ?? []).map((capability) => ({
                label: capability.displayName,
                value: capability.code,
              }))}
              placeholder="从服务端能力目录选择"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        confirmLoading={updateMutation.isPending}
        destroyOnHidden
        okText="保存"
        open={editingRole !== null}
        title="编辑角色"
        onCancel={closeEdit}
        onOk={() => editForm.submit()}
      >
        <Form form={editForm} layout="vertical" onFinish={submitEdit}>
          <Form.Item
            label="角色名称"
            name="name"
            rules={[{ required: true, whitespace: true, message: "请输入角色名称" }, { max: 100 }]}
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item label="描述" name="description" rules={[{ max: 500 }]}>
            <Input.TextArea maxLength={500} rows={3} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: "请选择状态" }]}>
            <Select
              options={[
                { label: "启用", value: "ACTIVE" },
                { label: "停用", value: "INACTIVE" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        confirmLoading={grantsMutation.isPending}
        destroyOnHidden
        okText="替换授权"
        open={grantingRole !== null}
        title="管理角色授权"
        onCancel={closeGrants}
        onOk={() => grantForm.submit()}
      >
        <Typography.Paragraph type="secondary">
          当前角色已有的数据范围会在未移除的授权码上原样保留；新增授权不填写范围，避免浏览器猜测后端范围枚举。
        </Typography.Paragraph>
        <Form form={grantForm} layout="vertical" onFinish={submitGrants}>
          <Form.Item label="授权" name="grantCodes">
            <Select
              mode="multiple"
              options={(capabilitiesQuery.data ?? []).map((capability) => ({
                label: capability.displayName,
                value: capability.code,
              }))}
              placeholder="从服务端能力目录选择"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        confirmLoading={copyMutation.isPending}
        destroyOnHidden
        okText="复制"
        open={copyingRole !== null}
        title="复制角色"
        onCancel={closeCopy}
        onOk={() => copyForm.submit()}
      >
        <Form form={copyForm} layout="vertical" onFinish={submitCopy}>
          <Form.Item
            label="新角色名称"
            name="name"
            rules={[{ required: true, whitespace: true, message: "请输入角色名称" }, { max: 100 }]}
          >
            <Input maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        destroyOnHidden
        open={assignmentRole !== null}
        title={assignmentRole === null ? "成员分配" : `${assignmentRole.name}：成员分配`}
        width={560}
        onClose={closeAssignments}
      >
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <Typography.Text type="secondary">
            成员 ID
            仅能从服务端可见、在职的目录中选择；服务端会重新校验成员状态、角色可委派性与租户边界。
          </Typography.Text>
          {assignmentsQuery.isError ? (
            <Alert title="角色分配暂时无法加载" showIcon type="error" />
          ) : null}
          {memberQuery.isError ? (
            <Alert title="成员目录暂时无法加载，无法新增分配。" showIcon type="warning" />
          ) : null}
          {canAssign && canReadOrganization ? (
            <Form form={assignmentForm} layout="vertical" onFinish={submitAssignments}>
              <Form.Item
                label="新增成员"
                name="actorIds"
                rules={[{ required: true, message: "请选择至少一位成员" }]}
              >
                <Select
                  filterOption={false}
                  loading={memberQuery.isLoading}
                  mode="multiple"
                  options={memberOptions}
                  placeholder="搜索并选择成员"
                  showSearch
                  onSearch={setMemberKeyword}
                />
              </Form.Item>
              <Button htmlType="submit" loading={assignMutation.isPending} type="primary">
                添加分配
              </Button>
            </Form>
          ) : (
            <Alert
              title="新增分配还需要成员目录读取权限；浏览器不会手输成员 ID。"
              showIcon
              type="info"
            />
          )}
          <ResponsiveDataList
            columns={[
              { dataIndex: "actorId", key: "actorId", title: "成员 ID" },
              { dataIndex: "createdTime", key: "createdTime", title: "分配时间" },
              {
                key: "actions",
                title: "操作",
                render: (_, item: RoleAssignment) =>
                  canAssign && assignmentRole !== null ? (
                    <Popconfirm
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      okText="移除"
                      onConfirm={() =>
                        removeAssignmentMutation.mutate({
                          actorId: item.actorId,
                          role: assignmentRole,
                        })
                      }
                      title={`移除成员 ${item.actorId} 的角色分配？`}
                    >
                      <Button
                        danger
                        loading={
                          removeAssignmentMutation.isPending &&
                          removeAssignmentMutation.variables?.actorId === item.actorId
                        }
                        size="small"
                        type="link"
                      >
                        移除
                      </Button>
                    </Popconfirm>
                  ) : (
                    "—"
                  ),
              },
            ]}
            loading={assignmentsQuery.isLoading}
            onPageChange={(page, size) => setAssignmentPageRequest({ page, size })}
            page={assignmentPage}
            renderMobileItem={(item) => (
              <Card size="small" title={`成员 ${item.actorId}`}>
                <Typography.Text type="secondary">{item.createdTime}</Typography.Text>
              </Card>
            )}
            rowKey={(item) => item.actorId}
          />
        </Space>
      </Drawer>
    </RouteAuthority>
  );
}
