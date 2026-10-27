import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Input, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority } from "~/app/permissions/authority";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  defaultPageRequest,
  normalizePageRequest,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";

import { organizationKeys } from "../model/query-keys";

type Member = components["schemas"]["MemberProfileResponse"];

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

const columns: ColumnsType<Member> = [
  { dataIndex: "displayName", key: "displayName", title: "成员" },
  { dataIndex: "actorId", key: "actorId", title: "成员 ID" },
  { dataIndex: "email", key: "email", render: (value) => value ?? "—", title: "邮箱" },
  {
    dataIndex: "maskedPhoneNumber",
    key: "maskedPhoneNumber",
    render: (value) => value ?? "—",
    title: "手机号",
  },
  {
    dataIndex: "active",
    key: "active",
    render: (active: boolean) => (
      <Tag color={active ? "green" : "default"}>{active ? "在职" : "停用"}</Tag>
    ),
    title: "状态",
  },
];

export function OrganizationMembersPage() {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const membersQuery = useQuery({
    queryKey: organizationKeys.members(identityKey, request),
    queryFn: () =>
      apiClient?.getOrganizationMembers(request) ??
      Promise.reject(new Error("Organization members API is unavailable.")),
    enabled: apiClient !== null,
  });
  const page: PageResult<Member> = membersQuery.data
    ? {
        items: membersQuery.data.objectList,
        meta: {},
        page: membersQuery.data.pageNum,
        size: membersQuery.data.pageSize,
        total: membersQuery.data.totalNum < 0 ? null : membersQuery.data.totalNum,
      }
    : { ...defaultPageRequest, items: [], meta: {}, total: null };

  function setPage(nextPage: number, nextSize: number) {
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function setKeyword(keyword: string) {
    setSearchParams(updateSearch(searchParams, { keyword: keyword.trim() || undefined, page: 1 }));
  }

  return (
    <RouteAuthority authority={authority.organizationRead}>
      <main>
        <Space orientation="vertical" size="large" style={{ display: "flex" }}>
          <div>
            <Typography.Title level={2}>成员</Typography.Title>
            <Typography.Text type="secondary">
              仅展示当前租户中服务端确认可见的成员资料；成员范围和状态由服务端裁决。
            </Typography.Text>
            <ActionAuthority authority={authority.organizationWrite}>
              <div>
                <Button onClick={() => navigate("/organization/membership-requests")} type="link">
                  审核成员申请
                </Button>
              </div>
            </ActionAuthority>
          </div>
          <Input.Search
            allowClear
            defaultValue={request.keyword}
            key={request.keyword ?? ""}
            onSearch={setKeyword}
            placeholder="搜索成员姓名"
          />
          {membersQuery.isError ? (
            <Alert
              title={
                membersQuery.error instanceof ApiError
                  ? membersQuery.error.message
                  : "成员目录暂时无法加载"
              }
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            columns={columns}
            loading={membersQuery.isLoading}
            onPageChange={setPage}
            page={page}
            renderMobileItem={(member) => (
              <Card size="small" title={member.displayName}>
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text type="secondary">成员 ID：{member.actorId}</Typography.Text>
                  <Typography.Text>{member.email ?? "未提供邮箱"}</Typography.Text>
                  <Typography.Text>{member.maskedPhoneNumber ?? "未提供手机号"}</Typography.Text>
                  <Tag color={member.active ? "green" : "default"}>
                    {member.active ? "在职" : "停用"}
                  </Tag>
                </Space>
              </Card>
            )}
            rowKey={(member) => member.actorId}
          />
        </Space>
      </main>
    </RouteAuthority>
  );
}
