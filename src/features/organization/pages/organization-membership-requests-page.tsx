import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Popconfirm, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useMemo } from "react";
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

function time(value: string): string {
  return dayjs(value).format("YYYY-MM-DD HH:mm");
}

export function OrganizationMembershipRequestsPage() {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
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
    queryKey: organizationKeys.membershipRequests(identityKey, request),
    queryFn: () =>
      apiClient?.getMembershipRequests(request) ??
      Promise.reject(new Error("Membership requests API is unavailable.")),
    enabled: apiClient !== null,
  });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: organizationKeys.membershipRequests(identityKey, request),
    });
  const approveMutation = useMutation({
    mutationFn: (item: MembershipRequest) =>
      apiClient?.approveMembershipRequest(item.id) ??
      Promise.reject(new Error("Approval is unavailable.")),
    onSuccess: async () => {
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: organizationKeys.memberLists(identityKey) }),
      ]);
    },
  });
  const rejectMutation = useMutation({
    mutationFn: (item: MembershipRequest) =>
      apiClient?.rejectMembershipRequest(item.id) ??
      Promise.reject(new Error("Rejection is unavailable.")),
    onSuccess: () => void refresh(),
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
    { dataIndex: "applicantActorId", key: "applicant", title: "申请成员" },
    {
      dataIndex: "targetDepartmentId",
      key: "department",
      render: (value) => value ?? "组织根目录",
      title: "目标部门",
    },
    { dataIndex: "message", key: "message", render: (value) => value ?? "—", title: "留言" },
    { dataIndex: "createdTime", key: "created", render: time, title: "申请时间" },
    { dataIndex: "status", key: "status", render: (value) => <Tag>{value}</Tag>, title: "状态" },
    {
      key: "actions",
      title: "操作",
      render: (_, item) =>
        item.status === "PENDING" ? (
          <Space>
            <Popconfirm
              cancelText="取消"
              okText="通过"
              onConfirm={() => approveMutation.mutate(item)}
              title="通过此成员申请？"
            >
              <Button
                loading={approveMutation.isPending && approveMutation.variables?.id === item.id}
                type="link"
              >
                通过
              </Button>
            </Popconfirm>
            <Popconfirm
              cancelText="取消"
              okButtonProps={{ danger: true }}
              okText="驳回"
              onConfirm={() => rejectMutation.mutate(item)}
              title="驳回此成员申请？"
            >
              <Button
                danger
                loading={rejectMutation.isPending && rejectMutation.variables?.id === item.id}
                type="link"
              >
                驳回
              </Button>
            </Popconfirm>
          </Space>
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

  const mutationError = approveMutation.error ?? rejectMutation.error;
  return (
    <RouteAuthority authority={authority.organizationWrite}>
      <main>
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <div>
            <Typography.Title level={2}>成员申请</Typography.Title>
            <Typography.Text type="secondary">
              仅显示当前租户服务端授权审核的申请；申请人、目标部门和状态机均由服务端再次校验。
            </Typography.Text>
          </div>
          {requestsQuery.isError ? (
            <Alert
              title={
                requestsQuery.error instanceof ApiError
                  ? requestsQuery.error.message
                  : "成员申请暂时无法加载"
              }
              showIcon
              type="error"
            />
          ) : null}
          {mutationError ? (
            <Alert
              title={
                mutationError instanceof ApiError ? mutationError.message : "申请操作暂时无法完成"
              }
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
              <Card size="small" title={`成员 ${item.applicantActorId}`}>
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{item.message ?? "未填写留言"}</Typography.Text>
                  <Typography.Text type="secondary">{time(item.createdTime)}</Typography.Text>
                  <Tag>{item.status}</Tag>
                </Space>
              </Card>
            )}
            rowKey={(item) => item.id}
          />
        </Space>
      </main>
    </RouteAuthority>
  );
}
