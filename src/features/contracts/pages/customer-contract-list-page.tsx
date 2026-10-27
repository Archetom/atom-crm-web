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

import { toContractListItem, type ContractListItem } from "../model/contract-list-item";
import { contractKeys } from "../model/query-keys";

import styles from "./customer-contract-list-page.module.css";
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

function displayDateRange(contract: ContractListItem): string {
  if (contract.startDate === null && contract.endDate === null) return "—";
  return `${contract.startDate ?? "未提供"} 至 ${contract.endDate ?? "未提供"}`;
}

function columnsFor(customerId: number): ColumnsType<ContractListItem> {
  return [
    {
      dataIndex: "number",
      key: "number",
      title: "合同编号",
      render: (value: string | null, item) => (
        <Link to={`/crm/customers/${customerId}/contracts/${item.id}`}>
          {value || `合同 ${item.id}`}
        </Link>
      ),
    },
    {
      dataIndex: "name",
      key: "name",
      title: "合同名称",
      render: (value: string | null) => value || "—",
    },
    {
      key: "period",
      title: "履约期间",
      render: (_value: unknown, item) => displayDateRange(item),
    },
    {
      dataIndex: "orderDate",
      key: "orderDate",
      title: "签约日期",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "contactId",
      key: "contactId",
      title: "联系人",
      render: (value: number | null) => displayReference("联系人", value),
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
      title: "状态",
      render: (value: string | null) => (value === null ? "—" : <Tag>{value}</Tag>),
    },
  ];
}

export function CustomerContractListPage() {
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
  const canReadContracts = hasAuthority(authorization, authority.contractsRead);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const contractsQuery = useQuery({
    queryKey: contractKeys.list(identityKey, request),
    queryFn: () =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer contracts are unavailable."))
        : apiClient.getContracts(request),
    enabled: apiClient !== null && customerId !== null && canReadContracts && canReadCustomers,
  });
  const page: PageResult<ContractListItem> = contractsQuery.data
    ? toPageResult(contractsQuery.data, (value) => {
        const contract = toContractListItem(value);
        return contract?.customerId === customerId ? contract : null;
      })
    : { ...defaultPageRequest, items: [], total: null, meta: {} };

  function setPage(nextPage: number, nextSize: number) {
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function setKeyword(keyword: string) {
    setSearchParams(updateSearch(searchParams, { keyword: keyword.trim() || undefined, page: 1 }));
  }

  if (customerId === null) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={authority.contractsRead}>
      <RouteAuthority authority={authority.customersRead}>
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
              <Typography.Title level={2}>客户合同</Typography.Title>
              <Typography.Text type="secondary">
                仅显示服务端确认当前客户可见范围内的合同；首期不展示或计算金额，也不新增侧栏菜单。
              </Typography.Text>
            </div>
            <Input.Search
              allowClear
              className={styles.search}
              defaultValue={request.keyword}
              key={request.keyword ?? ""}
              placeholder="搜索合同名称或编号"
              onSearch={setKeyword}
            />
            <ActionAuthority authority={authority.contractsWrite}>
              <ActionAuthority authority={authority.customersRead}>
                <Button
                  type="primary"
                  onClick={() => navigate(`/crm/customers/${customerId}/contracts/new`)}
                >
                  新建合同
                </Button>
              </ActionAuthority>
            </ActionAuthority>
          </section>
          {contractsQuery.isError ? (
            <Alert
              title={
                contractsQuery.error instanceof ApiError
                  ? contractsQuery.error.message
                  : "客户合同暂时无法加载"
              }
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            columns={columnsFor(customerId)}
            loading={contractsQuery.isLoading}
            page={page}
            rowKey={(contract) => contract.id}
            renderMobileItem={(contract) => (
              <Card
                className={styles.mobileCard}
                size="small"
                title={contract.name || contract.number || `合同 ${contract.id}`}
              >
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{contract.number || "未提供合同编号"}</Typography.Text>
                  <Typography.Text>{displayDateRange(contract)}</Typography.Text>
                  <Typography.Text>{`签约日期：${contract.orderDate ?? "未提供"}`}</Typography.Text>
                  <Typography.Text>
                    {displayReference("联系人", contract.contactId)}
                  </Typography.Text>
                  <Typography.Text>
                    {displayReference("成员", contract.ownerActorId)}
                  </Typography.Text>
                  <div className={styles.mobileMeta}>
                    {contract.status ? <Tag>{contract.status}</Tag> : null}
                  </div>
                </Space>
              </Card>
            )}
            onPageChange={setPage}
          />
        </main>
      </RouteAuthority>
    </RouteAuthority>
  );
}
