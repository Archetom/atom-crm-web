import { ArrowLeftOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Input, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  defaultPageRequest,
  normalizePageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";
import { StatusPage } from "~/components/feedback/status-page";
import { ApprovalStatusTag } from "~/features/approvals";

import { returnVisitKeys } from "../model/query-keys";
import { returnVisitFormLabel, returnVisitSatisfactionLabel } from "../model/return-visit-fields";
import { toReturnVisitListItem, type ReturnVisitListItem } from "../model/return-visit-list-item";

import styles from "./customer-return-visit-list-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

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

function displayReference(label: string, value: number | null): string {
  return value === null ? "—" : `${label} ${value}`;
}

function columnsFor(customerId: number): ColumnsType<ReturnVisitListItem> {
  return [
    {
      dataIndex: "visitNumber",
      key: "visitNumber",
      title: "回访编号",
      render: (value: string | null, item) => (
        <Link to={`/crm/customers/${customerId}/return-visits/${item.id}`}>
          {value || `回访 ${item.id}`}
        </Link>
      ),
    },
    {
      dataIndex: "visitTime",
      key: "visitTime",
      title: "回访时间",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "visitForm",
      key: "visitForm",
      title: "回访形式",
      render: (value) => returnVisitFormLabel(value),
    },
    {
      dataIndex: "satisfaction",
      key: "satisfaction",
      title: "客户满意度",
      render: (value) => returnVisitSatisfactionLabel(value),
    },
    {
      dataIndex: "remark",
      key: "remark",
      title: "客户反馈",
      render: (value: string | null) => value || "—",
    },
    {
      dataIndex: "contactId",
      key: "contactId",
      title: "联系人",
      render: (value: number | null) => displayReference("联系人", value),
    },
    {
      dataIndex: "contractId",
      key: "contractId",
      title: "合同",
      render: (value: number | null) => displayReference("合同", value),
    },
    {
      dataIndex: "ownerActorId",
      key: "ownerActorId",
      title: "负责人",
      render: (value: number | null) => displayReference("成员", value),
    },
    {
      dataIndex: "status",
      key: "status",
      title: "记录状态",
      render: (value: string | null) => (value === null ? "—" : <Tag>{value}</Tag>),
    },
    {
      dataIndex: "approvalStatus",
      key: "approvalStatus",
      title: "审批状态",
      render: (value) => <ApprovalStatusTag status={value} />,
    },
  ];
}

export function CustomerReturnVisitListPage() {
  const { customerId: customerIdParam } = useParams();
  const customerId = parseRouteId(customerIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.toString();
  const request = useMemo(() => {
    const params = new URLSearchParams(search);
    const page = normalizePageRequest({
      page: Number.parseInt(params.get("page") ?? "", 10),
      size: Number.parseInt(params.get("size") ?? "", 10),
    });
    const keyword = params.get("keyword")?.trim();
    return { ...page, customerId: customerId ?? undefined, keyword: keyword || undefined };
  }, [customerId, search]);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadReturnVisits = hasAuthority(authorization, authority.returnVisitsRead);
  const returnVisitsQuery = useQuery({
    queryKey: returnVisitKeys.list(identityKey, request),
    queryFn: () =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer return visits are unavailable."))
        : apiClient.getReturnVisits(request),
    enabled: apiClient !== null && customerId !== null && canReadReturnVisits,
  });
  const page: PageResult<ReturnVisitListItem> = returnVisitsQuery.data
    ? toPageResult(returnVisitsQuery.data, toReturnVisitListItem)
    : { ...defaultPageRequest, items: [], total: null, meta: {} };

  function setPage(nextPage: number, nextSize: number) {
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function setKeyword(keyword: string) {
    setSearchParams(updateSearch(searchParams, { keyword: keyword.trim() || undefined, page: 1 }));
  }

  if (customerId === null) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={authority.returnVisitsRead}>
      <main className={styles.page}>
        <section className={styles.toolbar}>
          <div>
            <Button
              icon={<ArrowLeftOutlined />}
              type="link"
              onClick={() => navigate(`/crm/customers/${customerId}`)}
            >
              返回客户详情
            </Button>
            <Typography.Title level={2}>客户回访</Typography.Title>
            <Typography.Text type="secondary">
              仅显示服务端确认当前客户可见范围内的回访及审批状态；本页不新增侧栏菜单，也不推断关联对象权限。
            </Typography.Text>
          </div>
          <Input.Search
            allowClear
            className={styles.search}
            defaultValue={request.keyword}
            key={request.keyword ?? ""}
            placeholder="搜索回访编号"
            onSearch={setKeyword}
          />
          <ActionAuthority authority={authority.returnVisitsWrite}>
            <Button
              type="primary"
              onClick={() => navigate(`/crm/customers/${customerId}/return-visits/new`)}
            >
              新建回访
            </Button>
          </ActionAuthority>
        </section>
        {returnVisitsQuery.isError ? (
          <Alert
            title={
              returnVisitsQuery.error instanceof ApiError
                ? returnVisitsQuery.error.message
                : "客户回访暂时无法加载"
            }
            showIcon
            type="error"
          />
        ) : null}
        <ResponsiveDataList
          columns={columnsFor(customerId)}
          loading={returnVisitsQuery.isLoading}
          page={page}
          rowKey={(returnVisit) => returnVisit.id}
          renderMobileItem={(returnVisit) => (
            <Card
              className={styles.mobileCard}
              size="small"
              title={returnVisit.visitNumber || `回访 ${returnVisit.id}`}
            >
              <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                <Typography.Text>{returnVisit.visitTime ?? "未提供回访时间"}</Typography.Text>
                <Typography.Text>
                  回访形式：{returnVisitFormLabel(returnVisit.visitForm)}
                </Typography.Text>
                <Typography.Text>
                  客户满意度：{returnVisitSatisfactionLabel(returnVisit.satisfaction)}
                </Typography.Text>
                <Typography.Text>{returnVisit.remark || "暂无客户反馈"}</Typography.Text>
                <Typography.Text>
                  {displayReference("联系人", returnVisit.contactId)}
                </Typography.Text>
                <Typography.Text>
                  {displayReference("合同", returnVisit.contractId)}
                </Typography.Text>
                <Typography.Text>
                  {displayReference("成员", returnVisit.ownerActorId)}
                </Typography.Text>
                <div className={styles.mobileMeta}>
                  <Typography.Text>
                    记录状态：{returnVisit.status === null ? "—" : <Tag>{returnVisit.status}</Tag>}
                  </Typography.Text>
                  <Typography.Text>
                    审批状态：
                    <ApprovalStatusTag status={returnVisit.approvalStatus} />
                  </Typography.Text>
                </div>
              </Space>
            </Card>
          )}
          onPageChange={setPage}
        />
      </main>
    </RouteAuthority>
  );
}
