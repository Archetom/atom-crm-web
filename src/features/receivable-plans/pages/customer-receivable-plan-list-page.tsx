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

import { receivablePlanKeys } from "../model/query-keys";
import {
  toReceivablePlanListItem,
  type ReceivablePlanListItem,
} from "../model/receivable-plan-list-item";

import styles from "./customer-receivable-plan-list-page.module.css";
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

function installmentLabel(value: number | null, id: number): string {
  return value === null ? `回款计划 ${id}` : `第 ${value} 期`;
}

function columnsFor(customerId: number): ColumnsType<ReceivablePlanListItem> {
  return [
    {
      dataIndex: "installment",
      key: "installment",
      title: "期数",
      render: (value: number | null, item) => (
        <Link to={`/crm/customers/${customerId}/receivable-plans/${item.id}`}>
          {installmentLabel(value, item.id)}
        </Link>
      ),
    },
    {
      dataIndex: "dueDate",
      key: "dueDate",
      title: "到期日期",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "contractId",
      key: "contractId",
      title: "合同",
      render: (value: number | null) => reference("合同", value),
    },
    {
      dataIndex: "progress",
      key: "progress",
      title: "进度",
      render: (value: string | null) => (value === null ? "—" : <Tag>{value}</Tag>),
    },
    {
      dataIndex: "status",
      key: "status",
      title: "状态",
      render: (value: string | null) => (value === null ? "—" : <Tag>{value}</Tag>),
    },
  ];
}

export function CustomerReceivablePlanListPage() {
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
  const canReadPlans = hasAuthority(authorization, authority.receivablePlansRead);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const plansQuery = useQuery({
    queryKey: receivablePlanKeys.list(identityKey, request),
    queryFn: () =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("客户回款计划暂时不可用。"))
        : apiClient.getReceivablePlans(request),
    enabled: apiClient !== null && customerId !== null && canReadPlans && canReadCustomers,
  });
  const page: PageResult<ReceivablePlanListItem> = plansQuery.data
    ? toPageResult(plansQuery.data, (value) => {
        const plan = toReceivablePlanListItem(value);
        return plan?.customerId === customerId ? plan : null;
      })
    : { ...defaultPageRequest, items: [], meta: {}, total: null };

  if (customerId === null) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={authority.receivablePlansRead}>
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
              <Typography.Title level={2}>客户回款计划</Typography.Title>
              <Typography.Text type="secondary">
                仅显示服务端确认当前客户可见范围内的期数、到期日期、关联、进度和状态；不展示或计算计划/已收/剩余金额，也不读取支付方式、备注、负责人、动态字段或附件。
              </Typography.Text>
            </div>
            <ActionAuthority authority={authority.receivablePlansWrite}>
              <ActionAuthority authority={authority.contractsRead}>
                <Space>
                  <Button
                    onClick={() =>
                      navigate(`/crm/customers/${customerId}/receivable-plans/batch-new`)
                    }
                  >
                    批量新建
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => navigate(`/crm/customers/${customerId}/receivable-plans/new`)}
                  >
                    新建回款计划
                  </Button>
                </Space>
              </ActionAuthority>
            </ActionAuthority>
          </section>
          {plansQuery.isError ? (
            <Alert
              title={
                plansQuery.error instanceof ApiError
                  ? plansQuery.error.message
                  : "客户回款计划暂时无法加载"
              }
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            columns={columnsFor(customerId)}
            loading={plansQuery.isLoading}
            page={page}
            rowKey={(plan) => plan.id}
            renderMobileItem={(plan) => (
              <Card
                className={styles.mobileCard}
                size="small"
                title={
                  <Link to={`/crm/customers/${customerId}/receivable-plans/${plan.id}`}>
                    {installmentLabel(plan.installment, plan.id)}
                  </Link>
                }
              >
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{`到期日期：${plan.dueDate ?? "未提供"}`}</Typography.Text>
                  <Typography.Text>{reference("合同", plan.contractId)}</Typography.Text>
                  <div className={styles.mobileMeta}>
                    {plan.progress === null ? null : <Tag>{plan.progress}</Tag>}
                    {plan.status === null ? null : <Tag>{plan.status}</Tag>}
                  </div>
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
