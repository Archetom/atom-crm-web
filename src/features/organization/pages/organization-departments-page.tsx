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
  Tree,
  Typography,
} from "antd";
import type { DataNode } from "antd/es/tree";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  defaultPageRequest,
  normalizePageRequest,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";

import { organizationKeys } from "../model/query-keys";

type Department = components["schemas"]["DepartmentResponse"];
type Member = components["schemas"]["DepartmentMemberProfileResponse"];

interface DepartmentNameDraft {
  name: string;
}

interface DepartmentMoveDraft {
  parentDepartmentId: number;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
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

function positiveInteger(value: string | null): number | undefined {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

const memberColumns: ColumnsType<Member> = [
  {
    dataIndex: "active",
    key: "active",
    render: (active: boolean) => (
      <Tag color={active ? "green" : "default"}>{active ? "在职" : "停用"}</Tag>
    ),
    title: "状态",
  },
  { dataIndex: "displayName", key: "displayName", title: "姓名" },
  { dataIndex: "loginName", key: "loginName", render: (value) => value ?? "—", title: "登录名" },
  { dataIndex: "email", key: "email", render: (value) => value ?? "—", title: "邮箱" },
  {
    dataIndex: "maskedPhoneNumber",
    key: "maskedPhoneNumber",
    render: (value) => value ?? "—",
    title: "手机号（登录名）",
  },
  {
    dataIndex: "departmentName",
    key: "departmentName",
    render: (value) => value ?? "—",
    title: "部门",
  },
  {
    dataIndex: "roleNames",
    key: "roleNames",
    render: (value: readonly string[] | undefined) => value?.join("、") || "—",
    title: "角色",
  },
];

function descendantIds(
  departments: readonly Department[],
  departmentId: number,
): ReadonlySet<number> {
  const descendants = new Set<number>();
  const pending = [departmentId];
  while (pending.length > 0) {
    const parentId = pending.pop();
    for (const department of departments) {
      if (department.parentDepartmentId === parentId && !descendants.has(department.id)) {
        descendants.add(department.id);
        pending.push(department.id);
      }
    }
  }
  return descendants;
}

function treeData(
  departments: readonly Department[],
  actions: {
    createChild: (department: Department) => void;
    deactivate: (department: Department) => void;
    delete: (department: Department) => void;
    edit: (department: Department) => void;
    move: (department: Department) => void;
  },
  pendingId: number | null,
): DataNode[] {
  const byParent = new Map<number | null, Department[]>();
  const ids = new Set(departments.map((department) => department.id));
  for (const department of departments) {
    const parentId = department.parentDepartmentId ?? null;
    const key = parentId !== null && ids.has(parentId) ? parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), department]);
  }

  const build = (parentId: number | null, ancestors: ReadonlySet<number>): DataNode[] =>
    (byParent.get(parentId) ?? [])
      .filter((department) => !ancestors.has(department.id))
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))
      .map((department) => ({
        children: build(department.id, new Set([...ancestors, department.id])),
        key: department.id,
        title: (
          <Space size="small" wrap>
            <Typography.Text delete={!department.active}>{department.name}</Typography.Text>
            <Tag>{department.status}</Tag>
            <ActionAuthority authority={authority.organizationWrite}>
              <Button onClick={() => actions.edit(department)} size="small" type="link">
                重命名
              </Button>
              <Button onClick={() => actions.move(department)} size="small" type="link">
                移动
              </Button>
              {department.active ? (
                <Button onClick={() => actions.createChild(department)} size="small" type="link">
                  新建子部门
                </Button>
              ) : null}
              {department.active ? (
                <Popconfirm
                  cancelText="取消"
                  description="服务端会再次确认该部门没有活动子部门或成员。"
                  okText="确认停用"
                  onConfirm={() => actions.deactivate(department)}
                  title={`停用部门“${department.name}”？`}
                >
                  <Button loading={pendingId === department.id} size="small" type="link">
                    停用
                  </Button>
                </Popconfirm>
              ) : null}
              <Popconfirm
                cancelText="取消"
                okButtonProps={{ danger: true }}
                okText="确认删除"
                onConfirm={() => actions.delete(department)}
                title={`删除部门“${department.name}”？`}
              >
                <Button danger loading={pendingId === department.id} size="small" type="link">
                  删除
                </Button>
              </Popconfirm>
            </ActionAuthority>
          </Space>
        ),
      }));

  return build(null, new Set());
}

export function OrganizationDepartmentsPage() {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createParent, setCreateParent] = useState<Department | null | undefined>(undefined);
  const [editing, setEditing] = useState<Department | null>(null);
  const [moving, setMoving] = useState<Department | null>(null);
  const [createForm] = Form.useForm<DepartmentNameDraft>();
  const [editForm] = Form.useForm<DepartmentNameDraft>();
  const [moveForm] = Form.useForm<DepartmentMoveDraft>();
  const identityKey = authState?.identityKey ?? "pending";
  const departmentsQuery = useQuery({
    queryKey: organizationKeys.departments(identityKey),
    queryFn: () =>
      apiClient?.getOrganizationDepartments() ??
      Promise.reject(new Error("Organization departments API is unavailable.")),
    enabled: apiClient !== null,
  });
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);
  const serializedSearch = searchParams.toString();
  const memberRequest = useMemo(() => {
    const current = new URLSearchParams(serializedSearch);
    const page = normalizePageRequest({
      page: Number.parseInt(current.get("memberPage") ?? "", 10),
      size: Number.parseInt(current.get("memberSize") ?? "", 10),
    });
    const keyword = current.get("memberKeyword")?.trim();
    return {
      ...page,
      includeDescendants: current.get("includeDescendants") === "true" ? true : undefined,
      keyword: keyword || undefined,
    } satisfies components["schemas"]["DepartmentMemberQueryRequest"];
  }, [serializedSearch]);
  const requestedDepartmentId = positiveInteger(searchParams.get("departmentId"));
  const selectedDepartment =
    requestedDepartmentId === undefined
      ? undefined
      : departments.find((department) => department.id === requestedDepartmentId);
  const selectedDepartmentId = selectedDepartment?.id;
  const departmentMembersQuery = useQuery({
    queryKey:
      selectedDepartmentId === undefined
        ? organizationKeys.departmentMembers(identityKey, 0, memberRequest)
        : organizationKeys.departmentMembers(identityKey, selectedDepartmentId, memberRequest),
    queryFn: () =>
      selectedDepartmentId === undefined || apiClient === null
        ? Promise.reject(new Error("请先选择一个当前可见的部门。"))
        : apiClient.getOrganizationDepartmentMembers(selectedDepartmentId, memberRequest),
    enabled: apiClient !== null && selectedDepartmentId !== undefined,
  });
  const departmentMemberPage: PageResult<Member> = departmentMembersQuery.data
    ? {
        items: departmentMembersQuery.data.objectList,
        meta: {},
        page: departmentMembersQuery.data.pageNum,
        size: departmentMembersQuery.data.pageSize,
        total: departmentMembersQuery.data.totalNum,
      }
    : { ...defaultPageRequest, items: [], meta: {}, total: null };
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: organizationKeys.departments(identityKey) });
  const createMutation = useMutation({
    mutationFn: ({ name, parentDepartmentId }: { name: string; parentDepartmentId?: number }) =>
      apiClient?.createOrganizationDepartment({ name, parentDepartmentId }) ??
      Promise.reject(new Error("Department creation is unavailable.")),
    onSuccess: () => {
      void invalidate();
      setCreateParent(undefined);
      createForm.resetFields();
    },
  });
  const renameMutation = useMutation({
    mutationFn: ({ departmentId, name }: { departmentId: number; name: string }) =>
      apiClient?.renameOrganizationDepartment(departmentId, { name }) ??
      Promise.reject(new Error("Department rename is unavailable.")),
    onSuccess: () => {
      void invalidate();
      setEditing(null);
      editForm.resetFields();
    },
  });
  const moveMutation = useMutation({
    mutationFn: ({
      departmentId,
      parentDepartmentId,
    }: {
      departmentId: number;
      parentDepartmentId?: number;
    }) =>
      apiClient?.moveOrganizationDepartment(departmentId, { parentDepartmentId }) ??
      Promise.reject(new Error("Department move is unavailable.")),
    onSuccess: () => {
      void invalidate();
      setMoving(null);
      moveForm.resetFields();
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: (department: Department) =>
      apiClient?.deactivateOrganizationDepartment(department.id) ??
      Promise.reject(new Error("Department deactivation is unavailable.")),
    onSuccess: () => void invalidate(),
  });
  const deleteMutation = useMutation({
    mutationFn: (department: Department) =>
      apiClient?.deleteOrganizationDepartment(department.id) ??
      Promise.reject(new Error("Department deletion is unavailable.")),
    onSuccess: () => void invalidate(),
  });
  const parentOptions = useMemo(
    () =>
      departments
        .filter((department) => department.active)
        .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))
        .map((department) => ({ label: department.name, value: department.id })),
    [departments],
  );
  const moveOptions = useMemo(() => {
    if (moving === null) return parentOptions;
    const blocked = new Set(descendantIds(departments, moving.id));
    blocked.add(moving.id);
    return parentOptions.filter((option) => !blocked.has(option.value));
  }, [departments, moving, parentOptions]);
  const pendingId = deactivateMutation.isPending
    ? (deactivateMutation.variables?.id ?? null)
    : deleteMutation.isPending
      ? (deleteMutation.variables?.id ?? null)
      : null;

  function openCreate(parent: Department | null) {
    createMutation.reset();
    createForm.resetFields();
    setCreateParent(parent);
  }

  function openEdit(department: Department) {
    renameMutation.reset();
    editForm.setFieldsValue({ name: department.name });
    setEditing(department);
  }

  function openMove(department: Department) {
    moveMutation.reset();
    moveForm.setFieldsValue({ parentDepartmentId: department.parentDepartmentId ?? 0 });
    setMoving(department);
  }

  function selectDepartment(departmentId: number | undefined) {
    setSearchParams(
      updateSearch(searchParams, {
        departmentId,
        memberPage: departmentId === undefined ? undefined : 1,
      }),
    );
  }

  function clearDepartmentSelection() {
    setSearchParams(
      updateSearch(searchParams, {
        departmentId: undefined,
        includeDescendants: undefined,
        memberPage: undefined,
      }),
    );
  }

  function updateMemberPage(page: number, size: number) {
    setSearchParams(updateSearch(searchParams, { memberPage: page, memberSize: size }));
  }

  function updateMemberKeyword(keyword: string) {
    setSearchParams(
      updateSearch(searchParams, { memberKeyword: keyword.trim() || undefined, memberPage: 1 }),
    );
  }

  function updateMemberScope(includeDescendants: boolean) {
    setSearchParams(
      updateSearch(searchParams, {
        includeDescendants: includeDescendants ? "true" : undefined,
        memberPage: 1,
      }),
    );
  }

  return (
    <RouteAuthority authority={authority.organizationRead}>
      <main>
        <Space align="start" orientation="vertical" size="large" style={{ display: "flex" }}>
          <div>
            <Typography.Title level={2}>员工与部门管理</Typography.Title>
            <Typography.Text type="secondary">
              选择部门后显示服务端裁决范围内的在职成员；可按需包含在职子部门。部门归属由服务端解析，登录名与角色仅在当前权限允许时返回。
            </Typography.Text>
          </div>
          <ActionAuthority authority={authority.organizationWrite}>
            <Button onClick={() => openCreate(null)} type="primary">
              新建根部门
            </Button>
          </ActionAuthority>
          {departmentsQuery.isError ? (
            <Alert
              title={errorMessage(departmentsQuery.error, "部门目录暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          {[createMutation, renameMutation, moveMutation, deactivateMutation, deleteMutation]
            .filter((mutation) => mutation.isError)
            .map((mutation, index) => (
              <Alert
                key={index}
                title={errorMessage(mutation.error, "部门操作暂时无法完成")}
                showIcon
                type="error"
              />
            ))}
          <Card title="企业组织架构">
            {departmentsQuery.isLoading ? (
              <Spin />
            ) : (
              <Tree
                defaultExpandAll
                onSelect={(selectedKeys) => {
                  const selectedKey = selectedKeys[0];
                  selectDepartment(typeof selectedKey === "number" ? selectedKey : undefined);
                }}
                selectedKeys={selectedDepartmentId === undefined ? [] : [selectedDepartmentId]}
                treeData={treeData(
                  departments,
                  {
                    createChild: (department) => openCreate(department),
                    deactivate: (department) => deactivateMutation.mutate(department),
                    delete: (department) => deleteMutation.mutate(department),
                    edit: openEdit,
                    move: openMove,
                  },
                  pendingId,
                )}
              />
            )}
          </Card>
          <Card
            extra={
              selectedDepartment ? (
                <Button onClick={clearDepartmentSelection} type="link">
                  取消部门筛选
                </Button>
              ) : null
            }
            title={selectedDepartment ? `“${selectedDepartment.name}”的成员` : "部门成员"}
          >
            {selectedDepartment === undefined ? (
              <Typography.Text type="secondary">请选择当前可见的部门后查看成员。</Typography.Text>
            ) : (
              <Space orientation="vertical" size="large" style={{ display: "flex" }}>
                <Space wrap>
                  <Input.Search
                    allowClear
                    aria-label="按部门搜索成员"
                    defaultValue={memberRequest.keyword}
                    key={memberRequest.keyword ?? ""}
                    onChange={(event) => {
                      if (event.target.value === "") updateMemberKeyword("");
                    }}
                    onSearch={updateMemberKeyword}
                    placeholder="搜索成员姓名"
                  />
                  <Checkbox
                    checked={memberRequest.includeDescendants === true}
                    onChange={(event) => updateMemberScope(event.target.checked)}
                  >
                    包含子部门
                  </Checkbox>
                </Space>
                {departmentMembersQuery.isError ? (
                  <Alert
                    title={errorMessage(departmentMembersQuery.error, "部门成员暂时无法加载")}
                    showIcon
                    type="error"
                  />
                ) : null}
                <ResponsiveDataList
                  columns={memberColumns}
                  loading={departmentMembersQuery.isLoading}
                  onPageChange={updateMemberPage}
                  page={departmentMemberPage}
                  renderMobileItem={(member) => (
                    <Card size="small" title={member.displayName}>
                      <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                        <Typography.Text>登录名：{member.loginName ?? "—"}</Typography.Text>
                        <Typography.Text>{member.email ?? "未提供邮箱"}</Typography.Text>
                        <Typography.Text>
                          {member.maskedPhoneNumber ?? "未提供手机号"}
                        </Typography.Text>
                        <Typography.Text>部门：{member.departmentName}</Typography.Text>
                        <Typography.Text>
                          角色：{member.roleNames?.join("、") || "—"}
                        </Typography.Text>
                        <Tag color={member.active ? "green" : "default"}>
                          {member.active ? "在职" : "停用"}
                        </Tag>
                      </Space>
                    </Card>
                  )}
                  rowKey={(member) => member.actorId}
                />
              </Space>
            )}
          </Card>
        </Space>
      </main>
      <Modal
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateParent(undefined)}
        onOk={() => createForm.submit()}
        open={createParent !== undefined}
        title={createParent === null ? "新建根部门" : `在“${createParent?.name}”下新建部门`}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={({ name }) =>
            createMutation.mutate({
              name: name.trim(),
              ...(createParent?.id === undefined ? {} : { parentDepartmentId: createParent.id }),
            })
          }
        >
          <Form.Item
            label="部门名称"
            name="name"
            rules={[{ required: true, message: "请输入部门名称" }]}
          >
            <Input maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        confirmLoading={renameMutation.isPending}
        onCancel={() => setEditing(null)}
        onOk={() => editForm.submit()}
        open={editing !== null}
        title="重命名部门"
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={({ name }) =>
            editing && renameMutation.mutate({ departmentId: editing.id, name: name.trim() })
          }
        >
          <Form.Item
            label="部门名称"
            name="name"
            rules={[{ required: true, message: "请输入部门名称" }]}
          >
            <Input maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        confirmLoading={moveMutation.isPending}
        onCancel={() => setMoving(null)}
        onOk={() => moveForm.submit()}
        open={moving !== null}
        title="移动部门"
      >
        <Form
          form={moveForm}
          layout="vertical"
          onFinish={({ parentDepartmentId }) =>
            moving &&
            moveMutation.mutate({
              departmentId: moving.id,
              ...(parentDepartmentId === 0 ? {} : { parentDepartmentId }),
            })
          }
        >
          <Form.Item
            label="上级部门"
            name="parentDepartmentId"
            rules={[{ required: true, message: "请选择上级部门" }]}
          >
            <Select options={[{ label: "组织根目录", value: 0 }, ...moveOptions]} />
          </Form.Item>
        </Form>
      </Modal>
    </RouteAuthority>
  );
}
