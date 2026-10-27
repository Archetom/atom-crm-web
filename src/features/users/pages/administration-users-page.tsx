import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
  message,
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
import { organizationKeys } from "~/features/organization";

import { userKeys } from "../model/query-keys";

type User = components["schemas"]["UserResponse"];
type UserStatus = User["status"];

interface UserCreateValues {
  email?: string;
  password?: string;
  phoneNumber?: string;
  realName?: string;
  username?: string;
}

const userStatusOptions: { label: string; value: UserStatus }[] = [
  { label: "启用", value: "ACTIVE" },
  { label: "停用", value: "INACTIVE" },
  { label: "锁定", value: "LOCKED" },
];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function statusLabel(status: UserStatus): string {
  return userStatusOptions.find((option) => option.value === status)?.label ?? status;
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

export function AdministrationUsersPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [statusUser, setStatusUser] = useState<User | null>(null);
  const [targetStatus, setTargetStatus] = useState<UserStatus>("ACTIVE");
  const [createForm] = Form.useForm<UserCreateValues>();
  const serializedSearch = searchParams.toString();
  const request = useMemo(() => {
    const current = new URLSearchParams(serializedSearch);
    const page = normalizePageRequest({
      page: Number.parseInt(current.get("page") ?? "", 10),
      size: Number.parseInt(current.get("size") ?? "", 10),
    });
    const status = userStatusOptions.find(
      (option) => option.value === current.get("status"),
    )?.value;
    return {
      ...page,
      email: normalizeOptional(current.get("email") ?? undefined),
      status,
      username: normalizeOptional(current.get("username") ?? undefined),
    } satisfies components["schemas"]["UserQueryRequest"];
  }, [serializedSearch]);
  const identityKey = authState?.identityKey ?? "pending";
  const canWrite = hasAuthority(authorization, authority.usersWrite);
  const canDelete = hasAuthority(authorization, authority.usersDelete);
  const usersQuery = useQuery({
    queryKey: userKeys.list(identityKey, request),
    queryFn: () =>
      apiClient?.getUsers(request) ?? Promise.reject(new Error("User API is unavailable.")),
    enabled: apiClient !== null,
  });
  const invalidateUsers = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: userKeys.all }),
      queryClient.invalidateQueries({ queryKey: organizationKeys.memberLists(identityKey) }),
    ]);
  const createMutation = useMutation({
    mutationFn: (requestBody: components["schemas"]["UserCreateRequest"]) =>
      apiClient?.createUser(requestBody) ?? Promise.reject(new Error("User API is unavailable.")),
    onSuccess: () => {
      void invalidateUsers();
      createForm.resetFields();
      setCreateOpen(false);
      message.success("用户已创建");
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { status: UserStatus; userId: number }) =>
      apiClient?.updateUserStatus(userId, status) ??
      Promise.reject(new Error("User API is unavailable.")),
    onSuccess: () => {
      void invalidateUsers();
      setStatusUser(null);
      message.success("用户状态已更新");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (userId: number) =>
      apiClient?.deleteUser(userId) ?? Promise.reject(new Error("User API is unavailable.")),
    onSuccess: () => {
      void invalidateUsers();
      message.success("用户已删除");
    },
  });
  const page: PageResult<User> = usersQuery.data
    ? {
        items: usersQuery.data.objectList,
        meta: {},
        page: usersQuery.data.pageNum,
        size: usersQuery.data.pageSize,
        total: usersQuery.data.totalNum,
      }
    : { ...defaultPageRequest, items: [], meta: {}, total: null };

  const columns: ColumnsType<User> = [
    { dataIndex: "username", key: "username", title: "用户名" },
    { dataIndex: "realName", key: "realName", render: (value) => value ?? "—", title: "姓名" },
    { dataIndex: "email", key: "email", title: "邮箱" },
    {
      dataIndex: "maskedPhoneNumber",
      key: "maskedPhoneNumber",
      render: (value) => value ?? "—",
      title: "手机号",
    },
    {
      dataIndex: "status",
      key: "status",
      render: (status: UserStatus) => (
        <Tag color={status === "ACTIVE" ? "green" : status === "LOCKED" ? "red" : "default"}>
          {statusLabel(status)}
        </Tag>
      ),
      title: "状态",
    },
    {
      key: "actions",
      render: (_, user) => (
        <Space size="small">
          <ActionAuthority authority={authority.usersWrite}>
            <Button
              onClick={() => {
                setStatusUser(user);
                setTargetStatus(user.status);
              }}
              size="small"
            >
              更改状态
            </Button>
          </ActionAuthority>
          <ActionAuthority authority={authority.usersDelete}>
            <Popconfirm
              cancelText="取消"
              description="删除后用户将不再出现在当前租户的目录中。"
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              okText="删除"
              onConfirm={() => deleteMutation.mutate(user.id)}
              title={`删除用户“${user.username}”？`}
            >
              <Button danger size="small">
                删除
              </Button>
            </Popconfirm>
          </ActionAuthority>
        </Space>
      ),
      title: "操作",
    },
  ];

  function setPage(nextPage: number, nextSize: number) {
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function setFilter(name: "email" | "status" | "username", value: string | undefined) {
    setSearchParams(updateSearch(searchParams, { [name]: value, page: 1 }));
  }

  function submitCreate(values: UserCreateValues) {
    const username = normalizeOptional(values.username);
    const email = normalizeOptional(values.email);
    if (username === undefined || email === undefined || values.password === undefined) return;
    createMutation.mutate({
      email,
      password: values.password,
      phoneNumber: normalizeOptional(values.phoneNumber),
      realName: normalizeOptional(values.realName),
      username,
    });
  }

  return (
    <RouteAuthority authority={authority.usersRead}>
      <main>
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <div>
            <Typography.Title level={2}>用户</Typography.Title>
            <Typography.Text type="secondary">
              新建用户会同步加入当前租户；停用、锁定或删除会同步关闭其成员访问资格。
            </Typography.Text>
          </div>
          <Space wrap>
            <Input.Search
              aria-label="按用户名搜索"
              allowClear
              defaultValue={request.username}
              key={request.username ?? ""}
              onChange={(event) => {
                if (event.target.value === "") setFilter("username", undefined);
              }}
              onSearch={(value) => setFilter("username", normalizeOptional(value))}
              placeholder="用户名"
            />
            <Input.Search
              aria-label="按邮箱搜索"
              allowClear
              defaultValue={request.email}
              key={request.email ?? ""}
              onChange={(event) => {
                if (event.target.value === "") setFilter("email", undefined);
              }}
              onSearch={(value) => setFilter("email", normalizeOptional(value))}
              placeholder="邮箱"
            />
            <Select
              aria-label="按用户状态筛选"
              allowClear
              onChange={(value: UserStatus | undefined) => setFilter("status", value)}
              options={userStatusOptions}
              placeholder="全部状态"
              value={request.status}
              style={{ minWidth: 128 }}
            />
            <ActionAuthority authority={authority.usersWrite}>
              <Button onClick={() => setCreateOpen(true)} type="primary">
                新建用户
              </Button>
            </ActionAuthority>
          </Space>
          {usersQuery.isError ? (
            <Alert
              title={errorMessage(usersQuery.error, "用户目录暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            columns={columns}
            loading={usersQuery.isLoading}
            onPageChange={setPage}
            page={page}
            renderMobileItem={(user) => (
              <Card size="small" title={user.username}>
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{user.realName ?? "未提供姓名"}</Typography.Text>
                  <Typography.Text>{user.email}</Typography.Text>
                  <Typography.Text>{user.maskedPhoneNumber ?? "未提供手机号"}</Typography.Text>
                  <Tag
                    color={
                      user.status === "ACTIVE"
                        ? "green"
                        : user.status === "LOCKED"
                          ? "red"
                          : "default"
                    }
                  >
                    {statusLabel(user.status)}
                  </Tag>
                  {canWrite || canDelete ? (
                    <Space size="small">
                      <ActionAuthority authority={authority.usersWrite}>
                        <Button
                          onClick={() => {
                            setStatusUser(user);
                            setTargetStatus(user.status);
                          }}
                          size="small"
                        >
                          更改状态
                        </Button>
                      </ActionAuthority>
                      <ActionAuthority authority={authority.usersDelete}>
                        <Popconfirm
                          cancelText="取消"
                          description="删除后用户将不再出现在当前租户的目录中。"
                          okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
                          okText="删除"
                          onConfirm={() => deleteMutation.mutate(user.id)}
                          title={`删除用户“${user.username}”？`}
                        >
                          <Button danger size="small">
                            删除
                          </Button>
                        </Popconfirm>
                      </ActionAuthority>
                    </Space>
                  ) : null}
                </Space>
              </Card>
            )}
            rowKey={(user) => user.id}
          />
        </Space>
        <Modal
          cancelText="取消"
          confirmLoading={createMutation.isPending}
          destroyOnHidden
          onCancel={() => {
            createForm.resetFields();
            setCreateOpen(false);
          }}
          onOk={() => void createForm.submit()}
          okText="创建"
          open={createOpen}
          title="新建用户"
        >
          <Form form={createForm} layout="vertical" onFinish={submitCreate}>
            <Form.Item
              label="用户名"
              name="username"
              rules={[
                { required: true, whitespace: true, message: "请输入用户名" },
                { max: 50, min: 3, message: "用户名长度为 3–50 个字符" },
                { pattern: /^[A-Za-z0-9_]+$/, message: "用户名仅可使用字母、数字和下划线" },
              ]}
            >
              <Input autoComplete="username" maxLength={50} />
            </Form.Item>
            <Form.Item
              label="邮箱"
              name="email"
              rules={[
                { required: true, message: "请输入邮箱" },
                { type: "email", message: "请输入有效邮箱" },
              ]}
            >
              <Input autoComplete="email" maxLength={254} />
            </Form.Item>
            <Form.Item
              label="初始密码"
              name="password"
              rules={[
                { required: true, message: "请输入初始密码" },
                { max: 64, min: 12, message: "密码长度为 12–64 个字符" },
              ]}
            >
              <Input.Password autoComplete="new-password" maxLength={64} />
            </Form.Item>
            <Form.Item label="姓名" name="realName" rules={[{ max: 100 }]}>
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item label="手机号" name="phoneNumber">
              <Input inputMode="tel" maxLength={20} placeholder="+8613800138000" />
            </Form.Item>
          </Form>
          {createMutation.isError ? (
            <Alert
              title={errorMessage(createMutation.error, "新建用户失败")}
              showIcon
              style={{ marginTop: 16 }}
              type="error"
            />
          ) : null}
        </Modal>
        <Modal
          cancelText="取消"
          confirmLoading={statusMutation.isPending}
          onCancel={() => setStatusUser(null)}
          onOk={() => {
            if (statusUser !== null) {
              statusMutation.mutate({ status: targetStatus, userId: statusUser.id });
            }
          }}
          okText="保存状态"
          open={statusUser !== null}
          title="更改用户状态"
        >
          <Typography.Paragraph>
            将“{statusUser?.username}”设为以下状态。服务端会重新校验状态转换。
          </Typography.Paragraph>
          <Select
            aria-label="用户状态"
            onChange={setTargetStatus}
            options={userStatusOptions}
            style={{ width: "100%" }}
            value={targetStatus}
          />
          {statusMutation.isError ? (
            <Alert
              title={errorMessage(statusMutation.error, "更新用户状态失败")}
              showIcon
              style={{ marginTop: 16 }}
              type="error"
            />
          ) : null}
        </Modal>
      </main>
    </RouteAuthority>
  );
}
