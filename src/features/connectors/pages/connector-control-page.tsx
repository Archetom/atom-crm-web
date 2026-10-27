import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
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
import { useState } from "react";
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

import { connectorKeys } from "../model/query-keys";

type Connector = components["schemas"]["ConnectorResponse"];
type ConnectorCredential = components["schemas"]["ConnectorCredentialResponse"];
type ConnectorQuery = components["schemas"]["ConnectorQueryRequest"];
type ConnectorStatus = Connector["status"];

interface OneTimeCredential {
  credential: string;
  title: string;
}

const connectorStatuses: ConnectorStatus[] = ["ACTIVE", "DISABLED", "RETIRED"];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const time = new Date(value);
  return Number.isNaN(time.valueOf()) ? "—" : time.toLocaleString("zh-CN", { hour12: false });
}

function statusLabel(status: ConnectorStatus): string {
  if (status === "ACTIVE") return "启用";
  if (status === "DISABLED") return "已停用";
  return "已退役";
}

function statusColor(status: ConnectorStatus): "default" | "green" | "orange" {
  if (status === "ACTIVE") return "green";
  if (status === "DISABLED") return "orange";
  return "default";
}

function statusChange(
  status: ConnectorStatus,
): { confirmation: string; danger?: boolean; label: string; target: ConnectorStatus } | undefined {
  if (status === "ACTIVE") {
    return {
      confirmation: "停用后，此连接器的入口认证会立即失效；可以稍后重新启用。",
      label: "停用",
      target: "DISABLED",
    };
  }
  if (status === "DISABLED") {
    return {
      confirmation: "启用后，仍未撤销的密钥可以再次用于连接器入口认证。",
      label: "启用",
      target: "ACTIVE",
    };
  }
  return undefined;
}

export function ConnectorControlPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConnectorId, setSelectedConnectorId] = useState<number | null>(null);
  const [oneTimeCredential, setOneTimeCredential] = useState<OneTimeCredential | null>(null);
  const [messageApi, messageContext] = message.useMessage();
  const identityKey = authState?.identityKey ?? "pending";
  const canRead = hasAuthority(authorization, authority.connectorsRead);
  const pagination = normalizePageRequest({
    page: Number.parseInt(searchParams.get("page") ?? "", 10),
    size: Number.parseInt(searchParams.get("size") ?? "", 10),
  });
  const statusValue = searchParams.get("status");
  const selectedStatus = connectorStatuses.includes(statusValue as ConnectorStatus)
    ? (statusValue as ConnectorStatus)
    : undefined;
  const query: ConnectorQuery = {
    page: pagination.page,
    size: pagination.size,
    status: selectedStatus,
  };
  const connectorsQuery = useQuery({
    queryKey: connectorKeys.list(identityKey, query),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("连接器目录暂时不可用。"))
        : apiClient.getConnectors(query),
    enabled: apiClient !== null && canRead,
  });
  const connectorDetailQuery = useQuery({
    queryKey: connectorKeys.detail(identityKey, selectedConnectorId ?? 0),
    queryFn: () => {
      if (apiClient === null || selectedConnectorId === null) {
        return Promise.reject(new Error("连接器详情暂时不可用。"));
      }
      return apiClient.getConnector(selectedConnectorId);
    },
    enabled: apiClient !== null && canRead && selectedConnectorId !== null,
  });
  const invalidateConnectors = () => queryClient.invalidateQueries({ queryKey: connectorKeys.all });
  const createMutation = useMutation({
    mutationFn: async (): Promise<Connector> => {
      if (apiClient === null) throw new Error("连接器暂时不可用。");
      const created = await apiClient.createConnector();
      setOneTimeCredential({ credential: created.credential, title: "请立即保存连接器凭证" });
      return created.connector;
    },
    onSuccess: () => void invalidateConnectors(),
  });
  const rotateCredentialMutation = useMutation({
    mutationFn: async (connector: Connector): Promise<Connector> => {
      if (apiClient === null) throw new Error("连接器暂时不可用。");
      const created = await apiClient.rotateConnectorCredential(connector.id, connector.version);
      setOneTimeCredential({ credential: created.credential, title: "请立即保存新的连接器凭证" });
      return created.connector;
    },
    onSuccess: () => void invalidateConnectors(),
  });
  const revokeCredentialMutation = useMutation({
    mutationFn: ({
      connector,
      credential,
    }: {
      connector: Connector;
      credential: ConnectorCredential;
    }) =>
      apiClient === null
        ? Promise.reject(new Error("连接器暂时不可用。"))
        : apiClient.revokeConnectorCredential(connector.id, credential.keyId, connector.version),
    onSuccess: () => void invalidateConnectors(),
  });
  const statusMutation = useMutation({
    mutationFn: ({ connector, status }: { connector: Connector; status: ConnectorStatus }) =>
      apiClient === null
        ? Promise.reject(new Error("连接器暂时不可用。"))
        : apiClient.updateConnectorStatus(connector.id, { status, version: connector.version }),
    onSuccess: () => void invalidateConnectors(),
  });
  const page = connectorsQuery.data;
  const pageResult: PageResult<Connector> = {
    ...defaultPageRequest,
    items: page?.objectList ?? [],
    meta: {},
    page: page?.pageNum ?? query.page ?? defaultPageRequest.page,
    size: page?.pageSize ?? query.size ?? defaultPageRequest.size,
    total: page?.totalNum ?? null,
  };
  const mutationError =
    createMutation.error ??
    rotateCredentialMutation.error ??
    revokeCredentialMutation.error ??
    statusMutation.error;

  function changeStatusFilter(value: string | undefined) {
    const next = new URLSearchParams(searchParams);
    if (value === undefined) next.delete("status");
    else next.set("status", value);
    next.set("page", "1");
    setSearchParams(next);
  }

  function changePage(pageNumber: number, size: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(pageNumber));
    next.set("size", String(size));
    setSearchParams(next);
  }

  async function copyCredential() {
    if (oneTimeCredential === null) return;
    try {
      await navigator.clipboard.writeText(oneTimeCredential.credential);
      void messageApi.success("凭证已复制，请存入受控密钥管理系统。");
    } catch {
      void messageApi.error("无法自动复制，请手动复制并妥善保存。");
    }
  }

  function closeCredential() {
    setOneTimeCredential(null);
    createMutation.reset();
    rotateCredentialMutation.reset();
  }

  function connectorActions(connector: Connector) {
    const change = statusChange(connector.status);
    const activeCredentials = connector.credentials.filter(
      (credential) => credential.status === "ACTIVE",
    );
    return (
      <Space wrap size="small">
        <Button size="small" type="link" onClick={() => setSelectedConnectorId(connector.id)}>
          详情
        </Button>
        <ActionAuthority authority={authority.connectorsManage}>
          {connector.status !== "RETIRED" && activeCredentials.length < 2 ? (
            <Popconfirm
              cancelText="取消"
              okText="生成凭证"
              title="轮换凭证？"
              description="服务端会生成一枚新的完整凭证且只返回一次；现有活动凭证保持有效，直到被撤销。"
              onConfirm={() => rotateCredentialMutation.mutate(connector)}
            >
              <Button
                loading={
                  rotateCredentialMutation.isPending &&
                  rotateCredentialMutation.variables?.id === connector.id
                }
                size="small"
              >
                轮换凭证
              </Button>
            </Popconfirm>
          ) : null}
          {change ? (
            <Popconfirm
              cancelText="取消"
              okButtonProps={{ danger: change.danger }}
              okText={change.label}
              title={`${change.label}连接器？`}
              description={change.confirmation}
              onConfirm={() => statusMutation.mutate({ connector, status: change.target })}
            >
              <Button
                danger={change.danger}
                loading={
                  statusMutation.isPending &&
                  statusMutation.variables?.connector.id === connector.id
                }
                size="small"
              >
                {change.label}
              </Button>
            </Popconfirm>
          ) : null}
          {connector.status !== "RETIRED" ? (
            <Popconfirm
              cancelText="取消"
              okButtonProps={{ danger: true }}
              okText="确认退役"
              title="永久退役连接器？"
              description="退役不可恢复，服务端会同时撤销全部凭证。"
              onConfirm={() => statusMutation.mutate({ connector, status: "RETIRED" })}
            >
              <Button
                danger
                loading={
                  statusMutation.isPending &&
                  statusMutation.variables?.connector.id === connector.id
                }
                size="small"
              >
                退役
              </Button>
            </Popconfirm>
          ) : null}
          {activeCredentials.map((credential) => (
            <Popconfirm
              cancelText="取消"
              key={credential.keyId}
              okButtonProps={{ danger: true }}
              okText="撤销凭证"
              title={`撤销凭证 ${credential.keyId}？`}
              description="撤销后该凭证会立即失效且不能恢复。"
              onConfirm={() => revokeCredentialMutation.mutate({ connector, credential })}
            >
              <Button
                danger
                loading={
                  revokeCredentialMutation.isPending &&
                  revokeCredentialMutation.variables?.credential.keyId === credential.keyId
                }
                size="small"
              >
                撤销 {credential.keyId}
              </Button>
            </Popconfirm>
          ))}
        </ActionAuthority>
      </Space>
    );
  }

  const columns: ColumnsType<Connector> = [
    { dataIndex: "connectorRef", key: "connectorRef", title: "连接器引用" },
    {
      dataIndex: "status",
      key: "status",
      title: "状态",
      render: (status: ConnectorStatus) => (
        <Tag color={statusColor(status)}>{statusLabel(status)}</Tag>
      ),
    },
    {
      dataIndex: "credentials",
      key: "credentials",
      title: "凭证元数据",
      render: (credentials: ConnectorCredential[]) =>
        credentials.map((credential) => (
          <Tag color={credential.status === "ACTIVE" ? "green" : "default"} key={credential.keyId}>
            {credential.keyId} · {credential.status === "ACTIVE" ? "有效" : "已撤销"}
          </Tag>
        )),
    },
    {
      dataIndex: "updatedTime",
      key: "updatedTime",
      title: "更新时间",
      render: (value: string) => formatDateTime(value),
    },
    { key: "actions", title: "操作", render: (_, connector) => connectorActions(connector) },
  ];

  return (
    <RouteAuthority authority={authority.connectorsRead}>
      {messageContext}
      <main>
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <section>
            <Typography.Title level={2}>连接器控制面</Typography.Title>
            <Typography.Text type="secondary">
              管理连接器注册、密钥轮换、撤销与生命周期。列表、详情和缓存均不保留完整凭证；创建或轮换后的凭证仅展示一次。
            </Typography.Text>
          </section>
          <Space wrap>
            <Select
              allowClear
              aria-label="按连接器状态筛选"
              options={connectorStatuses.map((status) => ({
                label: statusLabel(status),
                value: status,
              }))}
              placeholder="全部状态"
              style={{ minWidth: 150 }}
              value={selectedStatus}
              onChange={(value: string | undefined) => changeStatusFilter(value)}
            />
            <ActionAuthority authority={authority.connectorsManage}>
              <Popconfirm
                cancelText="取消"
                okText="创建连接器"
                title="创建连接器？"
                description="服务端会生成首个完整凭证并且只返回一次。"
                onConfirm={() => createMutation.mutate()}
              >
                <Button loading={createMutation.isPending} type="primary">
                  创建连接器
                </Button>
              </Popconfirm>
            </ActionAuthority>
          </Space>
          {connectorsQuery.isError ? (
            <Alert
              title={errorMessage(connectorsQuery.error, "连接器目录暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          {mutationError ? (
            <Alert
              title={errorMessage(mutationError, "连接器操作暂时无法完成")}
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            columns={columns}
            loading={connectorsQuery.isLoading}
            page={pageResult}
            rowKey={(connector) => connector.id}
            onPageChange={changePage}
            renderMobileItem={(connector) => (
              <Card
                extra={
                  <Tag color={statusColor(connector.status)}>{statusLabel(connector.status)}</Tag>
                }
                size="small"
                title={connector.connectorRef}
              >
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>凭证数量：{connector.credentials.length}</Typography.Text>
                  <Typography.Text>
                    更新时间：{formatDateTime(connector.updatedTime)}
                  </Typography.Text>
                  {connectorActions(connector)}
                </Space>
              </Card>
            )}
          />
        </Space>
      </main>
      <Modal
        destroyOnHidden
        footer={<Button onClick={() => setSelectedConnectorId(null)}>关闭</Button>}
        open={selectedConnectorId !== null}
        title="连接器详情"
        onCancel={() => setSelectedConnectorId(null)}
      >
        {connectorDetailQuery.isError ? (
          <Alert
            title={errorMessage(connectorDetailQuery.error, "连接器详情暂时无法加载")}
            showIcon
            type="error"
          />
        ) : connectorDetailQuery.data ? (
          <Space orientation="vertical" size="small" style={{ display: "flex" }}>
            <Typography.Text>连接器引用：{connectorDetailQuery.data.connectorRef}</Typography.Text>
            <Typography.Text>状态：{statusLabel(connectorDetailQuery.data.status)}</Typography.Text>
            <Typography.Text>
              创建时间：{formatDateTime(connectorDetailQuery.data.createdTime)}
            </Typography.Text>
            <Typography.Text>
              退役时间：{formatDateTime(connectorDetailQuery.data.retiredTime)}
            </Typography.Text>
            <Typography.Text strong>凭证元数据</Typography.Text>
            {connectorDetailQuery.data.credentials.map((credential) => (
              <Card key={credential.keyId} size="small">
                <Typography.Text>{credential.keyId}</Typography.Text>
                <br />
                <Typography.Text type="secondary">
                  {credential.status === "ACTIVE" ? "有效" : "已撤销"} · 创建于{" "}
                  {formatDateTime(credential.createdTime)}
                </Typography.Text>
              </Card>
            ))}
          </Space>
        ) : null}
      </Modal>
      <Modal
        destroyOnHidden
        footer={[
          <Button key="copy" onClick={() => void copyCredential()} type="primary">
            复制凭证
          </Button>,
          <Button key="close" onClick={closeCredential}>
            我已保存
          </Button>,
        ]}
        open={oneTimeCredential !== null}
        title={oneTimeCredential?.title ?? "请立即保存连接器凭证"}
        onCancel={closeCredential}
      >
        <Alert
          title="完整凭证仅在本次创建或轮换成功后展示一次。关闭此窗口、刷新或离开页面后无法恢复。"
          showIcon
          type="warning"
        />
        <Input
          aria-label="一次性连接器凭证"
          readOnly
          style={{ marginTop: 16 }}
          value={oneTimeCredential?.credential ?? ""}
        />
      </Modal>
    </RouteAuthority>
  );
}
