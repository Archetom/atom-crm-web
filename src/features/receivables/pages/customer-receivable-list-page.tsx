import { ArrowLeftOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Space, Tag, Typography } from "antd";
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

import { receivableKeys } from "../model/query-keys";
import { toReceivableListItem, type ReceivableListItem } from "../model/receivable-list-item";

import styles from "./customer-receivable-list-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

function updateSearch(current: URLSearchParams, page: number, size: number): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set("page", String(page));
  next.set("size", String(size));
  return next;
}

function reference(label: string, value: number | null): string {
  return value === null ? "—" : `${label} ${value}`;
}

function columnsFor(customerId: number): ColumnsType<ReceivableListItem> {
  return [
    {
      dataIndex: "receiptNumber",
      key: "receiptNumber",
      title: "回款编号",
      render: (value: string | null, item) => (
        <Link to={`/crm/customers/${customerId}/receivables/${item.id}`}>
          {value ?? `回款 ${item.id}`}
        </Link>
      ),
    },
    {
      dataIndex: "receivedDate",
      key: "receivedDate",
      title: "回款日期",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "contractId",
      key: "contractId",
      title: "合同",
      render: (value: number | null) => reference("合同", value),
    },
    {
      dataIndex: "receivablePlanId",
      key: "receivablePlanId",
      title: "回款计划",
      render: (value: number | null) => reference("计划", value),
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

export function CustomerReceivableListPage() {
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
    return { ...page, customerId: customerId ?? undefined };
  }, [customerId, search]);
  const identityKey = authState?.identityKey ?? "pending";
  const canReadReceivables = hasAuthority(authorization, authority.receivablesRead);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const receivablesQuery = useQuery({
    queryKey: receivableKeys.list(identityKey, request),
    queryFn: () =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("客户回款暂时不可用。"))
        : apiClient.getReceivables(request),
    enabled: apiClient !== null && customerId !== null && canReadReceivables && canReadCustomers,
  });
  const page: PageResult<ReceivableListItem> = receivablesQuery.data
    ? toPageResult(receivablesQuery.data, (value) => {
        const receivable = toReceivableListItem(value);
        return receivable?.customerId === customerId ? receivable : null;
      })
    : { ...defaultPageRequest, items: [], meta: {}, total: null };

  if (customerId === null) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={authority.receivablesRead}>
      <RouteAuthority authority={authority.customersRead}>
        <main className={styles.page}>
          <section className={styles.heading}>
            <div>
              <Button
                icon={<ArrowLeftOutlined />}
                type="link"
                onClick={() => navigate(`/crm/customers/${customerId}`)}
              >
                返回客户详情
              </Button>
              <Typography.Title level={2}>客户回款</Typography.Title>
              <Typography.Text type="secondary">
                仅显示服务端确认当前客户可见范围内的回款编号、日期、关联、记录状态和审批状态；不展示或计算金额，也不读取支付方式、备注、负责人、动态字段或附件。
              </Typography.Text>
            </div>
            <ActionAuthority authority={authority.receivablesWrite}>
              <ActionAuthority authority={authority.contractsRead}>
                <Button
                  type="primary"
                  onClick={() => navigate(`/crm/customers/${customerId}/receivables/new`)}
                >
                  新建回款
                </Button>
              </ActionAuthority>
            </ActionAuthority>
          </section>
          {receivablesQuery.isError ? (
            <Alert
              title={
                receivablesQuery.error instanceof ApiError
                  ? receivablesQuery.error.message
                  : "客户回款暂时无法加载"
              }
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            columns={columnsFor(customerId)}
            loading={receivablesQuery.isLoading}
            page={page}
            rowKey={(receivable) => receivable.id}
            renderMobileItem={(receivable) => (
              <Card
                className={styles.mobileCard}
                size="small"
                title={
                  <Link to={`/crm/customers/${customerId}/receivables/${receivable.id}`}>
                    {receivable.receiptNumber ?? `回款 ${receivable.id}`}
                  </Link>
                }
              >
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{`回款日期：${receivable.receivedDate ?? "未提供"}`}</Typography.Text>
                  <Typography.Text>{reference("合同", receivable.contractId)}</Typography.Text>
                  <Typography.Text>
                    {reference("回款计划", receivable.receivablePlanId)}
                  </Typography.Text>
                  <Typography.Text>
                    记录状态：{receivable.status === null ? "—" : <Tag>{receivable.status}</Tag>}
                  </Typography.Text>
                  <Typography.Text>
                    审批状态：
                    <ApprovalStatusTag status={receivable.approvalStatus} />
                  </Typography.Text>
                </Space>
              </Card>
            )}
            onPageChange={(nextPage, nextSize) =>
              setSearchParams(updateSearch(searchParams, nextPage, nextSize))
            }
          />
        </main>
      </RouteAuthority>
    </RouteAuthority>
  );
}
