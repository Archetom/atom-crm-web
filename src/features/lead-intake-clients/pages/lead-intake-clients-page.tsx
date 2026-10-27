import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useNavigate } from "react-router";

import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { defaultPageRequest, type PageResult } from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";

import { leadIntakeClientKeys } from "../model/query-keys";

type LeadIntakeClient = components["schemas"]["LeadIntakeClientResponse"];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatDateTime(value: string): string {
  const time = new Date(value);
  return Number.isNaN(time.valueOf()) ? "—" : time.toLocaleString("zh-CN", { hour12: false });
}

export function LeadIntakeClientsPage() {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [credential, setCredential] = useState<string | null>(null);
  const [messageApi, messageContext] = message.useMessage();
  const identityKey = authState?.identityKey ?? "pending";
  const clientsQuery = useQuery({
    queryKey: leadIntakeClientKeys.list(identityKey),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("线索接入客户端暂时不可用。"))
        : apiClient.getLeadIntakeClients(),
    enabled: apiClient !== null,
  });
  const invalidateClients = () =>
    queryClient.invalidateQueries({ queryKey: leadIntakeClientKeys.all });
  const createMutation = useMutation({
    mutationFn: async () => {
      if (apiClient === null) throw new Error("线索接入客户端暂时不可用。");
      const created = await apiClient.createLeadIntakeClient();
      setCredential(created.apiKey);
      return created.client;
    },
    onSuccess: () => void invalidateClients(),
  });
  const deactivateMutation = useMutation({
    mutationFn: (client: LeadIntakeClient) =>
      apiClient === null
        ? Promise.reject(new Error("线索接入客户端暂时不可用。"))
        : apiClient.deactivateLeadIntakeClient(client.id, client.version),
    onSuccess: () => void invalidateClients(),
  });
  const clients = clientsQuery.data ?? [];
  const page: PageResult<LeadIntakeClient> = {
    ...defaultPageRequest,
    items: clients,
    meta: {},
    page: 1,
    size: Math.max(clients.length, 1),
    total: clients.length,
  };
  const mutationError = createMutation.error ?? deactivateMutation.error;

  const columns: ColumnsType<LeadIntakeClient> = [
    { dataIndex: "keyId", key: "keyId", title: "客户端标识" },
    {
      dataIndex: "ownerActorId",
      key: "ownerActorId",
      title: "负责人",
      render: (ownerActorId: number) => `成员 ${ownerActorId}`,
    },
    {
      dataIndex: "active",
      key: "active",
      title: "状态",
      render: (active: boolean) => (
        <Tag color={active ? "green" : "default"}>{active ? "启用" : "已停用"}</Tag>
      ),
    },
    {
      dataIndex: "createdTime",
      key: "createdTime",
      title: "创建时间",
      render: formatDateTime,
    },
    {
      key: "actions",
      title: "操作",
      render: (_, client) =>
        client.active ? (
          <ActionAuthority authority={authority.leadsIntakeManage}>
            <Popconfirm
              cancelText="取消"
              okText="停用"
              onConfirm={() => deactivateMutation.mutate(client)}
              title="停用后，使用该客户端的公开线索提交将立即失效。"
            >
              <Button danger loading={deactivateMutation.isPending} size="small">
                停用
              </Button>
            </Popconfirm>
          </ActionAuthority>
        ) : (
          "—"
        ),
    },
  ];

  async function copyCredential() {
    if (credential === null) return;
    try {
      await navigator.clipboard.writeText(credential);
      void messageApi.success("密钥已复制，请存入受控密钥管理系统。");
    } catch {
      void messageApi.error("无法自动复制，请手动复制并妥善保存。");
    }
  }

  function closeCredential() {
    setCredential(null);
    createMutation.reset();
  }

  return (
    <RouteAuthority authority={authority.leadsIntakeManage}>
      {messageContext}
      <main style={{ display: "grid", gap: 24 }}>
        <section
          style={{
            alignItems: "flex-start",
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "space-between",
          }}
        >
          <div>
            <Typography.Title level={2}>线索接入客户端</Typography.Title>
            <Typography.Text type="secondary">
              管理公开线索提交凭证；列表不返回密钥，服务端仍会实时校验负责人权限与客户端状态。
            </Typography.Text>
          </div>
          <Space>
            <Button onClick={() => navigate("/crm/leads")}>返回线索</Button>
            <ActionAuthority authority={authority.leadsIntakeManage}>
              <Button
                loading={createMutation.isPending}
                onClick={() => createMutation.mutate()}
                type="primary"
              >
                创建接入客户端
              </Button>
            </ActionAuthority>
          </Space>
        </section>
        {clientsQuery.isError ? (
          <Alert
            title={errorMessage(clientsQuery.error, "客户端列表暂时无法加载")}
            showIcon
            type="error"
          />
        ) : null}
        {mutationError ? (
          <Alert
            title={errorMessage(mutationError, "操作未完成，请稍后重试")}
            showIcon
            type="error"
          />
        ) : null}
        <ResponsiveDataList
          columns={columns}
          loading={clientsQuery.isLoading}
          page={page}
          rowKey={(client) => client.id}
          onPageChange={() => undefined}
          renderMobileItem={(client) => (
            <Card
              extra={
                client.active ? (
                  <ActionAuthority authority={authority.leadsIntakeManage}>
                    <Popconfirm
                      cancelText="取消"
                      okText="停用"
                      onConfirm={() => deactivateMutation.mutate(client)}
                      title="停用后，使用该客户端的公开线索提交将立即失效。"
                    >
                      <Button danger loading={deactivateMutation.isPending} size="small">
                        停用
                      </Button>
                    </Popconfirm>
                  </ActionAuthority>
                ) : null
              }
              size="small"
              title={client.keyId}
            >
              <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                <Typography.Text>负责人：成员 {client.ownerActorId}</Typography.Text>
                <Typography.Text>创建时间：{formatDateTime(client.createdTime)}</Typography.Text>
                <div>
                  <Tag color={client.active ? "green" : "default"}>
                    {client.active ? "启用" : "已停用"}
                  </Tag>
                </div>
              </Space>
            </Card>
          )}
        />
      </main>
      <Modal
        destroyOnHidden
        footer={[
          <Button key="copy" onClick={() => void copyCredential()} type="primary">
            复制密钥
          </Button>,
          <Button key="close" onClick={closeCredential}>
            我已保存
          </Button>,
        ]}
        onCancel={closeCredential}
        open={credential !== null}
        title="请立即保存接入密钥"
      >
        <Alert
          title="完整密钥仅在本次创建成功后展示一次。关闭此窗口或离开页面后无法恢复。"
          showIcon
          type="warning"
        />
        <Input
          aria-label="一次性线索接入密钥"
          readOnly
          style={{ marginTop: 16 }}
          value={credential ?? ""}
        />
      </Modal>
    </RouteAuthority>
  );
}
