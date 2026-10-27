import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

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
import { statusKindFromError } from "~/components/feedback/status-kind";
import { DataWorkspace } from "~/components/page/data-workspace";
import { FilterBar } from "~/components/page/filter-bar";
import { PageHeader } from "~/components/page/page-header";
import { customerKeys } from "~/features/customers";

import {
  toCustomerPoolCustomerListItem,
  type CustomerPoolCustomerListItem,
} from "../model/customer-pool-customer-list-item";
import { decodeCustomerPoolCatalog } from "../model/customer-pool-catalog";
import { customerPoolKeys } from "../model/query-keys";

import styles from "./customer-pool-customers-page.module.css";
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

interface ClaimCustomerActionProps {
  customer: CustomerPoolCustomerListItem;
  isPending: boolean;
  onClaim(customer: CustomerPoolCustomerListItem): void;
}

interface AssignCustomerActionProps {
  customer: CustomerPoolCustomerListItem;
  poolAdministrator: boolean;
  onAssign(customer: CustomerPoolCustomerListItem): void;
}

interface DeleteCustomerActionProps {
  customer: CustomerPoolCustomerListItem;
  isPending: boolean;
  poolAdministrator: boolean;
  onDelete(customer: CustomerPoolCustomerListItem): void;
}

function ClaimCustomerAction({ customer, isPending, onClaim }: Readonly<ClaimCustomerActionProps>) {
  if (customer.status !== "IN_POOL") return null;

  return (
    <ActionAuthority authority={authority.customerPoolsClaim}>
      <Popconfirm
        cancelText="取消"
        okText="确认领取"
        title={`确认领取客户“${customer.name}”吗？`}
        onConfirm={() => onClaim(customer)}
      >
        <Button disabled={isPending} type="link">
          领取
        </Button>
      </Popconfirm>
    </ActionAuthority>
  );
}

function AssignCustomerAction({
  customer,
  poolAdministrator,
  onAssign,
}: Readonly<AssignCustomerActionProps>) {
  if (customer.status !== "IN_POOL" || !poolAdministrator) return null;

  return (
    <ActionAuthority authority={authority.customerPoolsAssign}>
      <Button type="link" onClick={() => onAssign(customer)}>
        分配
      </Button>
    </ActionAuthority>
  );
}

function DeleteCustomerAction({
  customer,
  isPending,
  poolAdministrator,
  onDelete,
}: Readonly<DeleteCustomerActionProps>) {
  if (customer.status !== "IN_POOL" || !poolAdministrator) return null;

  return (
    <ActionAuthority authority={authority.customerPoolsDelete}>
      <Popconfirm
        cancelText="取消"
        description="删除后客户会进入服务端软删除状态，且无法再从此公海领取或分配。"
        okButtonProps={{ danger: true }}
        okText="确认删除"
        title={`确认删除客户“${customer.name}”吗？`}
        onConfirm={() => onDelete(customer)}
      >
        <Button danger disabled={isPending} type="link">
          删除
        </Button>
      </Popconfirm>
    </ActionAuthority>
  );
}

function columns(
  canReadCustomerDetails: boolean,
  isClaimPending: boolean,
  isDeletePending: boolean,
  poolAdministrator: boolean,
  onClaim: (customer: CustomerPoolCustomerListItem) => void,
  onAssign: (customer: CustomerPoolCustomerListItem) => void,
  onDelete: (customer: CustomerPoolCustomerListItem) => void,
): ColumnsType<CustomerPoolCustomerListItem> {
  return [
    {
      dataIndex: "name",
      key: "name",
      title: "客户姓名",
      render: (name: string, customer) =>
        canReadCustomerDetails ? <Link to={`/crm/customers/${customer.id}`}>{name}</Link> : name,
    },
    {
      dataIndex: "phoneNumber",
      key: "phoneNumber",
      title: "联系电话",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "ownerActorId",
      key: "ownerActorId",
      title: "负责人",
      render: (value: number | null) => (value === null ? "—" : `成员 ${value}`),
    },
    {
      dataIndex: "status",
      key: "status",
      title: "状态",
      render: (value: string | null) => value ?? "—",
    },
    {
      key: "actions",
      title: "操作",
      render: (_, customer) => (
        <Space size="small">
          <ClaimCustomerAction customer={customer} isPending={isClaimPending} onClaim={onClaim} />
          <AssignCustomerAction
            customer={customer}
            poolAdministrator={poolAdministrator}
            onAssign={onAssign}
          />
          <DeleteCustomerAction
            customer={customer}
            isPending={isDeletePending}
            poolAdministrator={poolAdministrator}
            onDelete={onDelete}
          />
        </Space>
      ),
    },
  ];
}

export function CustomerPoolCustomersPage() {
  const { poolId: poolIdParam } = useParams();
  const poolId = parseRouteId(poolIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assignCustomers, setAssignCustomers] = useState<readonly CustomerPoolCustomerListItem[]>(
    [],
  );
  const [assigneeKeyword, setAssigneeKeyword] = useState("");
  const [selectedCustomers, setSelectedCustomers] = useState<CustomerPoolCustomerListItem[]>([]);
  const search = searchParams.toString();
  const request = useMemo(() => {
    const params = new URLSearchParams(search);
    const page = normalizePageRequest({
      page: Number.parseInt(params.get("page") ?? "", 10),
      size: Number.parseInt(params.get("size") ?? "", 10),
    });
    const name = params.get("name")?.trim();
    return { ...page, name: name || undefined };
  }, [search]);
  const identityKey = authState?.identityKey ?? "pending";
  const catalogQuery = useQuery({
    queryKey: customerPoolKeys.catalog(identityKey),
    queryFn: async () => {
      if (apiClient === null) throw new Error("Customer pool catalog API is unavailable.");
      return decodeCustomerPoolCatalog(await apiClient.getCustomerPoolCatalog());
    },
    enabled: apiClient !== null && poolId !== null,
  });
  const pool = catalogQuery.data?.find((pool) => pool.id === poolId);
  const customersQuery = useQuery({
    queryKey:
      poolId === null
        ? customerPoolKeys.customers(identityKey, 0, request)
        : customerPoolKeys.customers(identityKey, poolId, request),
    queryFn: () =>
      poolId === null || apiClient === null
        ? Promise.reject(new Error("Customer pool customers API is unavailable."))
        : apiClient.getCustomerPoolCustomers(poolId, request),
    enabled: apiClient !== null && pool !== undefined,
  });
  const claimMutation = useMutation({
    mutationFn: (customers: readonly CustomerPoolCustomerListItem[]) =>
      poolId === null || apiClient === null
        ? Promise.reject(new Error("Customer-pool claim API is unavailable."))
        : apiClient.claimCustomerFromPool(poolId, {
            customers: customers.map((customer) => ({
              customerId: customer.id,
              version: customer.version,
            })),
          }),
    onSuccess: () => {
      setSelectedCustomers([]);
      void queryClient.invalidateQueries({ queryKey: customerPoolKeys.all });
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
    },
  });
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const assigneeQuery = useQuery({
    queryKey: ["member-selector", "customer-pool-assign", identityKey, assigneeKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer-pool assignee selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: assigneeKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && assignCustomers.length > 0 && canReadOrganization,
  });
  const assignMutation = useMutation({
    mutationFn: ({
      customers,
      ownerActorId,
    }: {
      customers: readonly CustomerPoolCustomerListItem[];
      ownerActorId: number;
    }) =>
      poolId === null || apiClient === null
        ? Promise.reject(new Error("Customer-pool assign API is unavailable."))
        : apiClient.assignCustomerFromPool(poolId, {
            ownerActorId,
            customers: customers.map((customer) => ({
              customerId: customer.id,
              version: customer.version,
            })),
          }),
    onSuccess: () => {
      setSelectedCustomers([]);
      void queryClient.invalidateQueries({ queryKey: customerPoolKeys.all });
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
      setAssignCustomers([]);
      setAssigneeKeyword("");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (customers: readonly CustomerPoolCustomerListItem[]) =>
      poolId === null || apiClient === null
        ? Promise.reject(new Error("Customer-pool delete API is unavailable."))
        : apiClient.deleteCustomerFromPool(poolId, {
            customers: customers.map((customer) => ({
              customerId: customer.id,
              version: customer.version,
            })),
          }),
    onSuccess: () => {
      setSelectedCustomers([]);
      void queryClient.invalidateQueries({ queryKey: customerPoolKeys.all });
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
    },
  });
  const page: PageResult<CustomerPoolCustomerListItem> = customersQuery.data
    ? toPageResult(customersQuery.data, toCustomerPoolCustomerListItem)
    : { ...defaultPageRequest, items: [], total: null, meta: {} };
  const canReadCustomerDetails = hasAuthority(authorization, authority.customersRead);
  const canClaimCustomers = hasAuthority(authorization, authority.customerPoolsClaim);
  const canAssignCustomers =
    pool?.administrator === true && hasAuthority(authorization, authority.customerPoolsAssign);
  const canDeleteCustomers =
    pool?.administrator === true && hasAuthority(authorization, authority.customerPoolsDelete);
  const canSelectCustomers = canClaimCustomers || canAssignCustomers || canDeleteCustomers;
  const customerRowSelection: TableProps<CustomerPoolCustomerListItem>["rowSelection"] =
    canSelectCustomers
      ? {
          selectedRowKeys: selectedCustomers.map((customer) => customer.id),
          getCheckboxProps: (customer) => ({ disabled: customer.status !== "IN_POOL" }),
          onChange: (_, customers) => setSelectedCustomers(customers),
        }
      : undefined;

  function setPage(nextPage: number, nextSize: number) {
    setSelectedCustomers([]);
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function setName(name: string) {
    setSelectedCustomers([]);
    setSearchParams(updateSearch(searchParams, { name: name.trim() || undefined, page: 1 }));
  }

  function claimCustomer(customer: CustomerPoolCustomerListItem) {
    claimMutation.mutate([customer]);
  }

  function deleteCustomer(customer: CustomerPoolCustomerListItem) {
    deleteMutation.mutate([customer]);
  }

  function openAssignPicker(customers: readonly CustomerPoolCustomerListItem[]) {
    assignMutation.reset();
    setAssigneeKeyword("");
    setAssignCustomers(customers);
  }

  function closeAssignPicker() {
    if (assignMutation.isPending) return;
    assignMutation.reset();
    setAssignCustomers([]);
    setAssigneeKeyword("");
  }

  if (poolId === null) return <StatusPage kind="not-found" />;

  if (catalogQuery.isLoading) {
    return (
      <div
        aria-label="正在加载客户公海"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (catalogQuery.isError) {
    return <StatusPage kind={statusKindFromError(catalogQuery.error)} />;
  }

  if (pool === undefined) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={authority.customerPoolsRead}>
      <main>
        <PageHeader
          description={
            <>
              <Link to="/crm/customer-pools">返回客户公海</Link>
              {` · ${pool.name}。列表、字段遮罩和客户关联范围均以服务端返回为准。`}
            </>
          }
          title="公海客户"
        />
        <FilterBar
          activeFilters={
            request.name
              ? [
                  {
                    key: "name",
                    label: `关键词：${request.name}`,
                    onClear: () => setName(""),
                  },
                ]
              : []
          }
          search={{
            label: "搜索公海内客户",
            placeholder: "搜索公海内客户",
            value: request.name,
            onSearch: setName,
          }}
          onClearAll={request.name ? () => setName("") : undefined}
        />
        <DataWorkspace
          errorMessage={
            customersQuery.isError
              ? customersQuery.error instanceof ApiError
                ? customersQuery.error.message
                : "公海客户暂时无法加载"
              : undefined
          }
          label="公海客户数据工作区"
        >
          {claimMutation.isSuccess ? (
            <Typography.Text role="status" type="success">
              已领取 {claimMutation.variables?.length ?? 0} 位客户。
            </Typography.Text>
          ) : null}
          {assignMutation.isSuccess ? (
            <Typography.Text role="status" type="success">
              已分配 {assignMutation.variables?.customers.length ?? 0} 位客户。
            </Typography.Text>
          ) : null}
          {deleteMutation.isSuccess ? (
            <Typography.Text role="status" type="success">
              已删除 {deleteMutation.variables?.length ?? 0} 位客户。
            </Typography.Text>
          ) : null}
          {claimMutation.isError ? (
            <Alert
              title={
                claimMutation.error instanceof ApiError
                  ? claimMutation.error.message
                  : "客户暂时无法领取"
              }
              showIcon
              type="error"
            />
          ) : null}
          {deleteMutation.isError ? (
            <Alert
              title={
                deleteMutation.error instanceof ApiError
                  ? deleteMutation.error.message
                  : "客户暂时无法删除"
              }
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            bulkActions={
              <Space>
                {canClaimCustomers ? (
                  <Popconfirm
                    cancelText="取消"
                    okText="确认领取"
                    title={`确认领取已选 ${selectedCustomers.length} 位客户吗？`}
                    onConfirm={() => claimMutation.mutate(selectedCustomers)}
                  >
                    <Button disabled={claimMutation.isPending || selectedCustomers.length === 0}>
                      批量领取
                    </Button>
                  </Popconfirm>
                ) : null}
                {canAssignCustomers && canReadOrganization ? (
                  <Button
                    disabled={assignMutation.isPending || selectedCustomers.length === 0}
                    onClick={() => openAssignPicker(selectedCustomers)}
                  >
                    批量分配
                  </Button>
                ) : null}
                {canDeleteCustomers ? (
                  <Popconfirm
                    cancelText="取消"
                    description="删除后这些客户会进入服务端软删除状态，且无法再从此公海领取或分配。"
                    okButtonProps={{ danger: true }}
                    okText="确认删除"
                    title={`确认删除已选 ${selectedCustomers.length} 位客户吗？`}
                    onConfirm={() => deleteMutation.mutate(selectedCustomers)}
                  >
                    <Button
                      danger
                      disabled={deleteMutation.isPending || selectedCustomers.length === 0}
                    >
                      批量删除
                    </Button>
                  </Popconfirm>
                ) : null}
              </Space>
            }
            columns={columns(
              canReadCustomerDetails,
              claimMutation.isPending,
              deleteMutation.isPending,
              pool.administrator,
              claimCustomer,
              (customer) => openAssignPicker([customer]),
              deleteCustomer,
            )}
            loading={customersQuery.isLoading}
            page={page}
            rowKey={(customer) => customer.id}
            rowSelection={customerRowSelection}
            selectedRowCount={selectedCustomers.length}
            renderMobileItem={(customer) => (
              <Card
                className={styles.mobileCard}
                size="small"
                title={
                  canReadCustomerDetails ? (
                    <Link to={`/crm/customers/${customer.id}`}>{customer.name}</Link>
                  ) : (
                    customer.name
                  )
                }
              >
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{customer.phoneNumber ?? "未提供联系电话"}</Typography.Text>
                  <div className={styles.mobileMeta}>
                    {customer.status ? <Tag>{customer.status}</Tag> : null}
                    {customer.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                  <ClaimCustomerAction
                    customer={customer}
                    isPending={claimMutation.isPending}
                    onClaim={claimCustomer}
                  />
                  <AssignCustomerAction
                    customer={customer}
                    poolAdministrator={pool.administrator}
                    onAssign={(customer) => openAssignPicker([customer])}
                  />
                  <DeleteCustomerAction
                    customer={customer}
                    isPending={deleteMutation.isPending}
                    poolAdministrator={pool.administrator}
                    onDelete={deleteCustomer}
                  />
                </Space>
              </Card>
            )}
            onPageChange={setPage}
          />
        </DataWorkspace>
        <Modal
          destroyOnHidden
          footer={null}
          open={assignCustomers.length > 0}
          title={assignCustomers.length > 1 ? "批量分配客户" : "分配客户"}
          onCancel={closeAssignPicker}
        >
          <Typography.Paragraph type="secondary">
            {assignCustomers.length === 0
              ? ""
              : assignCustomers.length === 1
                ? `将客户“${assignCustomers[0]?.name ?? ""}”分配给一位服务端可见的在职成员。最终成员资格、公海管理员资格与并发版本均由服务端复核。`
                : `将已选 ${assignCustomers.length} 位客户分配给一位服务端可见的在职成员。最终成员资格、公海管理员资格与每条记录的并发版本均由服务端复核。`}
          </Typography.Paragraph>
          {canReadOrganization ? (
            <>
              <Input.Search
                allowClear
                defaultValue={assigneeKeyword}
                placeholder="按成员姓名搜索"
                onSearch={(keyword) => setAssigneeKeyword(keyword)}
              />
              {assigneeQuery.isError ? (
                <Alert
                  title="成员列表暂时无法加载"
                  showIcon
                  style={{ marginTop: 12 }}
                  type="error"
                />
              ) : (
                <List
                  dataSource={[...(assigneeQuery.data ?? [])]}
                  loading={assigneeQuery.isLoading}
                  locale={{ emptyText: "未找到可分配成员" }}
                  renderItem={(member) => (
                    <List.Item
                      actions={[
                        <Button
                          disabled={assignMutation.isPending || assignCustomers.length === 0}
                          key={member.actorId}
                          loading={assignMutation.isPending}
                          type="link"
                          onClick={() => {
                            if (assignCustomers.length > 0) {
                              assignMutation.mutate({
                                customers: assignCustomers,
                                ownerActorId: member.actorId,
                              });
                            }
                          }}
                        >
                          分配给此成员
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        description={`成员 ${member.actorId}`}
                        title={member.displayName}
                      />
                    </List.Item>
                  )}
                />
              )}
            </>
          ) : (
            <Alert
              title="当前没有成员目录读取权限，无法选择客户分配对象。"
              showIcon
              type="warning"
            />
          )}
          {assignMutation.isError ? (
            <Alert
              title={
                assignMutation.error instanceof ApiError
                  ? assignMutation.error.message
                  : "客户暂时无法分配"
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : null}
        </Modal>
      </main>
    </RouteAuthority>
  );
}
