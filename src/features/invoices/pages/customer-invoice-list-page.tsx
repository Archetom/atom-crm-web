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

import { toInvoiceListItem, type InvoiceListItem } from "../model/invoice-list-item";
import { invoiceKeys } from "../model/query-keys";

import styles from "./customer-invoice-list-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

function updateSearch(current: URLSearchParams, page: number, size: number): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set("page", String(page));
  next.set("size", String(size));
  return next;
}

function columnsFor(customerId: number): ColumnsType<InvoiceListItem> {
  return [
    {
      dataIndex: "applicationNumber",
      key: "applicationNumber",
      title: "申请编号",
      render: (value: string | null, item) => (
        <Link to={`/crm/customers/${customerId}/invoices/${item.id}`}>
          {value ?? `发票 ${item.id}`}
        </Link>
      ),
    },
    {
      dataIndex: "invoiceNumber",
      key: "invoiceNumber",
      title: "发票号码",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "invoiceType",
      key: "invoiceType",
      title: "发票类型",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "requestedDate",
      key: "requestedDate",
      title: "申请日期",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "issuedDate",
      key: "issuedDate",
      title: "开票日期",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "contractId",
      key: "contractId",
      title: "合同",
      render: (value: number | null) => (value === null ? "—" : `合同 ${value}`),
    },
    {
      dataIndex: "status",
      key: "status",
      title: "状态",
      render: (value: string | null) => (value === null ? "—" : <Tag>{value}</Tag>),
    },
  ];
}

export function CustomerInvoiceListPage() {
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
  const canReadInvoices = hasAuthority(authorization, authority.invoicesRead);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const invoicesQuery = useQuery({
    queryKey: invoiceKeys.list(identityKey, request),
    queryFn: () =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer invoices are unavailable."))
        : apiClient.getInvoices(request),
    enabled: apiClient !== null && customerId !== null && canReadInvoices && canReadCustomers,
  });
  const page: PageResult<InvoiceListItem> = invoicesQuery.data
    ? toPageResult(invoicesQuery.data, (value) => {
        const invoice = toInvoiceListItem(value);
        return invoice?.customerId === customerId ? invoice : null;
      })
    : { ...defaultPageRequest, items: [], meta: {}, total: null };

  if (customerId === null) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={authority.invoicesRead}>
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
              <Typography.Title level={2}>客户发票</Typography.Title>
              <Typography.Text type="secondary">
                仅显示服务端确认当前客户可见范围内的发票身份、引用、状态和日期；不展示或计算金额，也不读取收件或开票抬头资料。
              </Typography.Text>
            </div>
            <ActionAuthority authority={authority.invoicesWrite}>
              <ActionAuthority authority={authority.contractsRead}>
                <Button
                  type="primary"
                  onClick={() => navigate(`/crm/customers/${customerId}/invoices/new`)}
                >
                  新建发票
                </Button>
              </ActionAuthority>
            </ActionAuthority>
          </section>
          {invoicesQuery.isError ? (
            <Alert
              title={
                invoicesQuery.error instanceof ApiError
                  ? invoicesQuery.error.message
                  : "客户发票暂时无法加载"
              }
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            columns={columnsFor(customerId)}
            loading={invoicesQuery.isLoading}
            page={page}
            rowKey={(invoice) => invoice.id}
            renderMobileItem={(invoice) => (
              <Card
                className={styles.mobileCard}
                size="small"
                title={
                  <Link to={`/crm/customers/${customerId}/invoices/${invoice.id}`}>
                    {invoice.applicationNumber ?? invoice.invoiceNumber ?? `发票 ${invoice.id}`}
                  </Link>
                }
              >
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{invoice.invoiceNumber ?? "未提供发票号码"}</Typography.Text>
                  <Typography.Text>{`申请日期：${invoice.requestedDate ?? "未提供"}`}</Typography.Text>
                  <Typography.Text>{`开票日期：${invoice.issuedDate ?? "未提供"}`}</Typography.Text>
                  <Typography.Text>
                    {invoice.contractId === null ? "未提供合同引用" : `合同 ${invoice.contractId}`}
                  </Typography.Text>
                  {invoice.status === null ? null : <Tag>{invoice.status}</Tag>}
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
