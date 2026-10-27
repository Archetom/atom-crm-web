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
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  defaultPageRequest,
  normalizePageRequest,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";

import { organizationKeys } from "../model/query-keys";

type MembershipRequest = components["schemas"]["MembershipRequestResponse"];

interface MembershipRequestValues {
  message?: string;
  targetTenantId?: number;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function time(value: string): string {
  return dayjs(value).format("YYYY-MM-DD HH:mm");
}

function statusLabel(status: MembershipRequest["status"]): string {
  switch (status) {
    case "APPROVED":
      return "已通过";
    case "PENDING":
      return "待审核";
    case "REJECTED":
      return "已驳回";
    case "WITHDRAWN":
      return "已撤回";
    default:
      return status;
  }
}

function normalizeMessage(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function OrganizationMyMembershipRequestsPage() {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm<MembershipRequestValues>();
  const serializedSearch = searchParams.toString();
  const request = useMemo(
    () =>
      normalizePageRequest({
        page: Number.parseInt(new URLSearchParams(serializedSearch).get("page") ?? "", 10),
        size: Number.parseInt(new URLSearchParams(serializedSearch).get("size") ?? "", 10),
      }),
    [serializedSearch],
  );
  const identityKey = authState?.identityKey ?? "pending";
  const requestsQuery = useQuery({
    queryKey: organizationKeys.myMembershipRequests(identityKey, request),
    queryFn: () =>
      apiClient?.getMyMembershipRequests(request) ??
      Promise.reject(new Error("My membership requests API is unavailable.")),
    enabled: apiClient !== null,
  });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: organizationKeys.myMembershipRequests(identityKey, request),
    });
  const createMutation = useMutation({
    mutationFn: (values: MembershipRequestValues) => {
      if (apiClient === null || values.targetTenantId === undefined) {
        return Promise.reject(new Error("Membership request API is unavailable."));
      }
      return apiClient.submitMembershipRequest({
        message: normalizeMessage(values.message),
        targetTenantId: values.targetTenantId,
      });
    },
    onSuccess: () => {
      void refresh();
      createForm.resetFields();
      setCreateOpen(false);
      setPage(1, request.size);
      message.success("成员申请已提交");
    },
  });
  const withdrawMutation = useMutation({
    mutationFn: (item: MembershipRequest) =>
      apiClient?.withdrawMembershipRequest(item.id) ??
      Promise.reject(new Error("Membership withdrawal API is unavailable.")),
    onSuccess: () => {
      void refresh();
      message.success("成员申请已撤回");
    },
  });
  const page: PageResult<MembershipRequest> = requestsQuery.data
    ? {
        items: requestsQuery.data.objectList,
        meta: {},
        page: requestsQuery.data.pageNum,
        size: requestsQuery.data.pageSize,
        total: requestsQuery.data.totalNum < 0 ? null : requestsQuery.data.totalNum,
      }
    : { ...defaultPageRequest, items: [], meta: {}, total: null };
  const columns: ColumnsType<MembershipRequest> = [
    {
      dataIndex: "targetTenantId",
      key: "tenant",
      render: (value) => `租户 ${value}`,
      title: "目标租户",
    },
    {
      dataIndex: "targetDepartmentId",
      key: "department",
      render: (value) => (value === null || value === undefined ? "组织根目录" : `部门 ${value}`),
      title: "目标部门",
    },
    { dataIndex: "message", key: "message", render: (value) => value ?? "—", title: "申请说明" },
    { dataIndex: "createdTime", key: "created", render: time, title: "申请时间" },
    {
      dataIndex: "status",
      key: "status",
      render: (status: MembershipRequest["status"]) => <Tag>{statusLabel(status)}</Tag>,
      title: "状态",
    },
    {
      key: "actions",
      title: "操作",
      render: (_, item) =>
        item.status === "PENDING" ? (
          <Popconfirm
            cancelText="取消"
            okButtonProps={{ danger: true }}
            okText="撤回"
            onConfirm={() => withdrawMutation.mutate(item)}
            title="撤回这条成员申请？"
          >
            <Button
              danger
              loading={withdrawMutation.isPending && withdrawMutation.variables?.id === item.id}
              type="link"
            >
              撤回
            </Button>
          </Popconfirm>
        ) : (
          "—"
        ),
    },
  ];

  function setPage(pageNumber: number, size: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(pageNumber));
    next.set("size", String(size));
    setSearchParams(next);
  }

  return (
    <RouteAuthority authority={authority.organizationRequest}>
      <main>
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <div>
            <Typography.Title level={2}>我的成员申请</Typography.Title>
            <Typography.Text type="secondary">
              只显示当前申请人自己的记录。目标租户标识须由邀请或管理员提供，浏览器不会枚举其他租户。
            </Typography.Text>
          </div>
          <Button onClick={() => setCreateOpen(true)} type="primary">
            申请加入租户
          </Button>
          {requestsQuery.isError ? (
            <Alert
              title={errorMessage(requestsQuery.error, "成员申请暂时无法加载")}
              showIcon
              type="error"
            />
          ) : null}
          {withdrawMutation.isError ? (
            <Alert
              title={errorMessage(withdrawMutation.error, "成员申请暂时无法撤回")}
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            columns={columns}
            loading={requestsQuery.isLoading}
            onPageChange={setPage}
            page={page}
            renderMobileItem={(item) => (
              <Card size="small" title={`租户 ${item.targetTenantId}`}>
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>
                    {item.targetDepartmentId === null || item.targetDepartmentId === undefined
                      ? "组织根目录"
                      : `部门 ${item.targetDepartmentId}`}
                  </Typography.Text>
                  <Typography.Text>{item.message ?? "未填写申请说明"}</Typography.Text>
                  <Typography.Text type="secondary">{time(item.createdTime)}</Typography.Text>
                  <Tag>{statusLabel(item.status)}</Tag>
                </Space>
              </Card>
            )}
            rowKey={(item) => item.id}
          />
        </Space>
        <Modal
          confirmLoading={createMutation.isPending}
          destroyOnHidden
          onCancel={() => {
            createForm.resetFields();
            setCreateOpen(false);
          }}
          onOk={() => void createForm.submit()}
          open={createOpen}
          title="申请加入租户"
        >
          <Typography.Paragraph type="secondary">
            请填写由目标租户管理员或邀请流程提供的租户标识。服务端会验证租户、成员资格和申请状态；此操作不会切换当前登录租户。
          </Typography.Paragraph>
          <Form
            form={createForm}
            layout="vertical"
            onFinish={(values) => createMutation.mutate(values)}
          >
            <Form.Item
              label="目标租户 ID"
              name="targetTenantId"
              rules={[
                { required: true, message: "请输入目标租户 ID" },
                { type: "number", min: 1, message: "目标租户 ID 必须为正整数" },
              ]}
            >
              <InputNumber min={1} precision={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              label="申请说明"
              name="message"
              rules={[{ max: 500, message: "申请说明最多 500 个字符" }]}
            >
              <Input.TextArea maxLength={500} rows={4} showCount />
            </Form.Item>
          </Form>
          {createMutation.isError ? (
            <Alert
              title={errorMessage(createMutation.error, "成员申请暂时无法提交")}
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
