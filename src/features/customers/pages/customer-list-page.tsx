import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Modal, Select, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { components } from "~/api/generated/schema";
import { saveControlledDownload } from "~/api/client/controlled-download";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  defaultPageRequest,
  normalizePageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";
import { BatchTagModal } from "~/components/data-view/batch-tag-modal";
import type { BatchTagChange } from "~/components/data-view/batch-tag-change";
import { ListStarToggle } from "~/components/data-view/list-star-toggle";
import {
  ColumnPreferenceControls,
  type ColumnPreferenceOption,
} from "~/components/data-view/column-preference-controls";
import {
  dynamicListColumnOptions,
  dynamicListColumns,
} from "~/components/data-view/dynamic-list-columns";
import { createFieldMetadataQueryKeys } from "~/components/dynamic-field";
import { DataWorkspace } from "~/components/page/data-workspace";
import { FilterBar } from "~/components/page/filter-bar";
import { PageHeader } from "~/components/page/page-header";
import { BatchActivityModal } from "~/features/activities";
import { SavedViewControls } from "~/features/saved-views";
import { savedViewKeys } from "~/features/saved-views";
import { resolveSavedView, savedViewSelectionFromSearch } from "~/features/saved-views";

import { toCustomerListItem, type CustomerListItem } from "../model/customer-list-item";
import { selectedCustomerIdFromSearch } from "../model/customer-list-route";
import { customerKeys } from "../model/query-keys";
import { CustomerDetailDrawer } from "../components/customer-detail-drawer";
import { CustomerListDuplicateCheckModal } from "../components/customer-list-duplicate-check-modal";
import {
  toCustomerListDuplicateCheckRequest,
  type CustomerListDuplicateCheckValues,
} from "../model/customer-list-duplicate-check";
import {
  customerListSceneFromSearch,
  withCustomerListScene,
  type CustomerListScene,
} from "../model/customer-list-scene";
import {
  customerCustomSortOptions,
  customerListSortFromSearch,
  customerListSortLabel,
  customerListSortOptions,
  defaultCustomerListSort,
  resolveCustomerListSort,
  withCustomerListSort,
  type CustomerListSort,
} from "../model/customer-list-sort";

import styles from "./customer-list-page.module.css";

type VersionedCustomerListItem = CustomerListItem & { version: number };

function hasCustomerVersion(customer: CustomerListItem): customer is VersionedCustomerListItem {
  return (
    typeof customer.version === "number" &&
    Number.isSafeInteger(customer.version) &&
    customer.version >= 0
  );
}

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

const baseCustomerColumnOptions: readonly ColumnPreferenceOption[] = [
  { code: "customer_name", label: "客户名称" },
  { code: "phone_number", label: "联系电话" },
  { code: "owner_actor", label: "负责人" },
  { code: "tags", label: "标签" },
  { code: "status", label: "状态" },
];

const activityCustomerColumnOptions: readonly ColumnPreferenceOption[] = [
  { code: "last_activity_time", label: "最后跟进时间" },
  { code: "last_activity_content", label: "最后跟进记录" },
];

const allCustomerColumnOptions: readonly ColumnPreferenceOption[] = [
  ...baseCustomerColumnOptions,
  ...activityCustomerColumnOptions,
];

function formatLastActivityTime(value: string | null): string {
  return value === null ? "—" : value.replace("T", " ").slice(0, 16);
}

function columns(
  onOpen: (customer: CustomerListItem) => void,
  onToggleStar: (customer: CustomerListItem) => void,
  isStarUpdatePending: boolean,
  canReadActivities: boolean,
): ColumnsType<CustomerListItem> {
  const source: ColumnsType<CustomerListItem> = [
    {
      dataIndex: "name",
      fixed: "left",
      key: "customer_name",
      title: "客户名称",
      width: 260,
      render: (name: string, item) => (
        <Space size="small">
          <ListStarToggle
            loading={isStarUpdatePending}
            starred={item.starred}
            onToggle={() => onToggleStar(item)}
          />
          <Typography.Text strong>
            <Button data-detail-trigger-id={item.id} type="link" onClick={() => onOpen(item)}>
              {name}
            </Button>
          </Typography.Text>
        </Space>
      ),
    },
    {
      dataIndex: "phoneNumber",
      key: "phone_number",
      title: "联系电话",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "ownerActorId",
      key: "owner_actor",
      title: "负责人",
      render: (value: number | null) => (value === null ? "—" : `成员 ${value}`),
    },
    {
      dataIndex: "tags",
      key: "tags",
      title: "标签",
      render: (tags: string[]) =>
        tags.length === 0 ? "—" : tags.map((tag) => <Tag key={tag}>{tag}</Tag>),
    },
    {
      dataIndex: "status",
      key: "status",
      title: "状态",
      render: (value: string | null) => value ?? "—",
    },
    ...(canReadActivities
      ? [
          {
            dataIndex: "lastActivityTime",
            key: "last_activity_time",
            title: "最后跟进时间",
            render: formatLastActivityTime,
          },
          {
            dataIndex: "lastActivityContent",
            key: "last_activity_content",
            title: "最后跟进记录",
            render: (value: string | null) => value ?? "—",
          },
        ]
      : []),
    {
      fixed: "right",
      key: "actions",
      title: "操作",
      width: 88,
      render: (_, customer) => (
        <Button data-detail-trigger-id={customer.id} type="link" onClick={() => onOpen(customer)}>
          查看
        </Button>
      ),
    },
  ];
  return source;
}

const defaultCustomerExportFieldCodes = ["customer_name"] as const;

export function CustomerListPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [exportOpen, setExportOpen] = useState(false);
  const [duplicateCheckOpen, setDuplicateCheckOpen] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<CustomerListItem[]>([]);
  const [batchTagsOpen, setBatchTagsOpen] = useState(false);
  const [batchTagSuccessMessage, setBatchTagSuccessMessage] = useState<string | null>(null);
  const [batchActivitiesOpen, setBatchActivitiesOpen] = useState(false);
  const [batchActivitySuccessMessage, setBatchActivitySuccessMessage] = useState<string | null>(
    null,
  );
  const [temporaryConditions, setTemporaryConditions] = useState<
    components["schemas"]["FilterConditionRequest"][]
  >([]);
  const [visibleCustomerColumnCodes, setVisibleCustomerColumnCodes] = useState<readonly string[]>(
    () => allCustomerColumnOptions.map((option) => option.code),
  );
  const search = searchParams.toString();
  const scene = customerListSceneFromSearch(search);
  const requestedSort = customerListSortFromSearch(search);
  const request = useMemo(() => {
    const params = new URLSearchParams(search);
    const page = normalizePageRequest({
      page: Number.parseInt(params.get("page") ?? "", 10),
      size: Number.parseInt(params.get("size") ?? "", 10),
    });
    const keyword = params.get("keyword")?.trim();
    return { ...page, keyword: keyword || undefined };
  }, [search]);
  const identityKey = authState?.identityKey ?? "pending";
  const canCreateCustomers = hasAuthority(authorization, authority.customersWrite);
  const canChangeCustomerTags = hasAuthority(authorization, authority.customersWrite);
  const canReadActivities = hasAuthority(authorization, authority.activitiesRead);
  const canComposeActivities =
    canReadActivities && hasAuthority(authorization, authority.activitiesWrite);
  const canExportCustomers = hasAuthority(authorization, authority.customersExport);
  const canReadSavedViews = hasAuthority(authorization, authority.savedViewsRead);
  const canReadListFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const customerColumnOptions = useMemo(
    () => (canReadActivities ? allCustomerColumnOptions : baseCustomerColumnOptions),
    [canReadActivities],
  );
  const listFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "CUSTOMER", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("CUSTOMER"),
    enabled: apiClient !== null && canReadListFieldMetadata,
  });
  const customerListColumnOptions = useMemo(
    () => [
      ...customerColumnOptions,
      ...dynamicListColumnOptions(
        listFieldDefinitionsQuery.data ?? [],
        customerColumnOptions.map((option) => option.code),
      ),
    ],
    [customerColumnOptions, listFieldDefinitionsQuery.data],
  );
  const sort = useMemo(
    () => resolveCustomerListSort(requestedSort, listFieldDefinitionsQuery.data ?? []),
    [listFieldDefinitionsQuery.data, requestedSort],
  );
  const customerSortOptions = useMemo(
    () => [
      ...customerListSortOptions,
      ...customerCustomSortOptions(listFieldDefinitionsQuery.data ?? []),
    ],
    [listFieldDefinitionsQuery.data],
  );
  const savedViewSelection = useMemo(() => savedViewSelectionFromSearch(search), [search]);
  const savedViewsQuery = useQuery({
    queryKey: savedViewKeys.list(identityKey, "CUSTOMER", true),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("保存视图暂时不可用。"))
        : apiClient.listSavedViews("CUSTOMER", true),
    enabled: apiClient !== null && canReadSavedViews,
  });
  const activeSavedView = resolveSavedView(savedViewsQuery.data ?? [], savedViewSelection);
  const customerRequest = useMemo(
    () =>
      withCustomerListSort(
        withCustomerListScene(
          {
            ...request,
            ...(temporaryConditions.length > 0
              ? { conditions: temporaryConditions }
              : { savedViewId: activeSavedView?.id }),
          },
          scene,
          authorization?.actorId,
        ),
        sort,
      ),
    [activeSavedView?.id, authorization?.actorId, request, scene, sort, temporaryConditions],
  );
  const customersQuery = useQuery({
    queryKey:
      temporaryConditions.length > 0
        ? customerKeys.temporaryFilteredList(identityKey, customerRequest)
        : customerKeys.listRequest(identityKey, customerRequest),
    queryFn: () =>
      apiClient?.getCustomers(customerRequest) ??
      Promise.reject(new Error("API client is unavailable.")),
    enabled: apiClient !== null,
  });
  const exportMutation = useMutation({
    mutationFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer CSV export is unavailable."))
        : apiClient.exportCustomersCsv({
            fieldCodes: [...defaultCustomerExportFieldCodes],
            keyword: request.keyword,
            ownerActorId: customerRequest.ownerActorId,
            starred: customerRequest.starred,
            subordinateOwnerOnly: customerRequest.subordinateOwnerOnly,
            ...(temporaryConditions.length > 0
              ? { conditions: temporaryConditions }
              : { savedViewId: activeSavedView?.id }),
          }),
    onSuccess: (download) => {
      saveControlledDownload(download);
      setExportOpen(false);
    },
  });
  const duplicateCheckMutation = useMutation({
    mutationFn: (values: CustomerListDuplicateCheckValues) =>
      apiClient === null
        ? Promise.reject(new Error("Customer duplicate check is unavailable."))
        : apiClient.checkCustomerDuplicate(toCustomerListDuplicateCheckRequest(values)),
  });
  const batchTagMutation = useMutation({
    mutationFn: ({
      change,
      customers,
    }: {
      change: BatchTagChange;
      customers: VersionedCustomerListItem[];
    }) =>
      apiClient === null
        ? Promise.reject(new Error("客户批量标签 API 暂时不可用。"))
        : apiClient.changeCustomerTags({
            customers: customers.map((customer) => ({
              customerId: customer.id,
              version: customer.version,
            })),
            addedTags: change.addedTags.length > 0 ? change.addedTags : undefined,
            removedTags: change.removedTags.length > 0 ? change.removedTags : undefined,
          }),
    onSuccess: (_, { customers }) => {
      setSelectedCustomers([]);
      setBatchTagsOpen(false);
      setBatchTagSuccessMessage(`已更新 ${customers.length} 位客户的标签。`);
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
  const starMutation = useMutation({
    mutationFn: ({ customerId, starred }: { customerId: number; starred: boolean }) =>
      apiClient === null
        ? Promise.reject(new Error("客户关注 API 暂时不可用。"))
        : apiClient.setCustomerStarred(customerId, { starred }),
    onSuccess: async (_, { customerId }) => {
      await queryClient.invalidateQueries({
        queryKey: customerKeys.detail(identityKey, customerId),
      });
      await queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
    },
  });
  const page: PageResult<CustomerListItem> = customersQuery.data
    ? toPageResult(customersQuery.data, toCustomerListItem)
    : { ...defaultPageRequest, items: [], total: null, meta: {} };

  function setPage(nextPage: number, nextSize: number) {
    setSelectedCustomers([]);
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function setKeyword(keyword: string) {
    setSelectedCustomers([]);
    setSearchParams(updateSearch(searchParams, { keyword: keyword.trim() || undefined, page: 1 }));
  }

  function setScene(nextScene: CustomerListScene) {
    setSelectedCustomers([]);
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        scene: nextScene === "all" ? undefined : nextScene,
      }),
    );
  }

  function setSort(nextSort: CustomerListSort) {
    setSelectedCustomers([]);
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        sort: nextSort === defaultCustomerListSort ? undefined : nextSort,
      }),
    );
  }

  const selectedCustomerId = useMemo(() => selectedCustomerIdFromSearch(search), [search]);

  const openCustomer = useCallback(
    (customer: CustomerListItem) => {
      setSearchParams(updateSearch(searchParams, { customerId: customer.id }));
    },
    [searchParams, setSearchParams],
  );
  const toggleCustomerStar = useCallback(
    (customer: CustomerListItem) =>
      starMutation.mutate({ customerId: customer.id, starred: !customer.starred }),
    [starMutation],
  );

  const customerColumns = useMemo(() => {
    const source = [
      ...columns(openCustomer, toggleCustomerStar, starMutation.isPending, canReadActivities),
      ...dynamicListColumns<CustomerListItem>(
        listFieldDefinitionsQuery.data ?? [],
        customerColumnOptions.map((option) => option.code),
      ),
    ];
    const byCode = new Map(source.map((column) => [String(column.key), column]));
    const visible = visibleCustomerColumnCodes.flatMap((code) => {
      const column = byCode.get(code);
      return column === undefined ? [] : [column];
    });
    const action = byCode.get("actions");
    return action === undefined ? visible : [...visible, action];
  }, [
    canReadActivities,
    customerColumnOptions,
    listFieldDefinitionsQuery.data,
    openCustomer,
    starMutation.isPending,
    toggleCustomerStar,
    visibleCustomerColumnCodes,
  ]);

  const updateVisibleCustomerColumnCodes = useCallback((codes: readonly string[]) => {
    setVisibleCustomerColumnCodes((current) =>
      current.length === codes.length && current.every((code, index) => code === codes[index])
        ? current
        : codes,
    );
  }, []);

  function closeCustomerDrawer() {
    setSearchParams(updateSearch(searchParams, { customerId: undefined }));
  }

  function setSavedView(selection: number | null) {
    setSelectedCustomers([]);
    setTemporaryConditions([]);
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        savedView: selection === null ? "all" : selection,
      }),
    );
  }

  function clearFilters() {
    setSelectedCustomers([]);
    setTemporaryConditions([]);
    setSearchParams(
      updateSearch(searchParams, {
        keyword: undefined,
        page: 1,
        scene: undefined,
        sort: undefined,
      }),
    );
  }

  function setTemporaryFilterConditions(
    conditions: components["schemas"]["FilterConditionRequest"][],
  ) {
    setSelectedCustomers([]);
    setTemporaryConditions(conditions);
  }

  function openExport() {
    exportMutation.reset();
    setExportOpen(true);
  }

  function closeExport() {
    if (exportMutation.isPending) return;
    exportMutation.reset();
    setExportOpen(false);
  }

  function openDuplicateCheck() {
    duplicateCheckMutation.reset();
    setDuplicateCheckOpen(true);
  }

  function closeDuplicateCheck() {
    if (duplicateCheckMutation.isPending) return;
    duplicateCheckMutation.reset();
    setDuplicateCheckOpen(false);
  }

  function openBatchTags() {
    batchTagMutation.reset();
    setBatchTagsOpen(true);
  }

  function openBatchActivities() {
    setBatchActivitiesOpen(true);
  }

  function closeBatchActivities() {
    setBatchActivitiesOpen(false);
  }

  function completeBatchActivities(createdCount: number) {
    setSelectedCustomers([]);
    setBatchActivitiesOpen(false);
    setBatchActivitySuccessMessage(`已为 ${createdCount} 位客户批量记录跟进。`);
  }

  function closeBatchTags() {
    if (batchTagMutation.isPending) return;
    batchTagMutation.reset();
    setBatchTagsOpen(false);
  }

  function submitBatchTags(change: BatchTagChange) {
    const customers = selectedCustomers.filter(hasCustomerVersion);
    if (customers.length !== selectedCustomers.length) return;
    batchTagMutation.mutate({ change, customers });
  }

  const customerRowSelection: TableProps<CustomerListItem>["rowSelection"] =
    canChangeCustomerTags || canComposeActivities
      ? {
          selectedRowKeys: selectedCustomers.map((customer) => customer.id),
          getCheckboxProps: (customer) => ({
            disabled: !canComposeActivities && !hasCustomerVersion(customer),
          }),
          onChange: (_, customers) => setSelectedCustomers(customers),
        }
      : undefined;

  return (
    <RouteAuthority authority={authority.customersRead}>
      <main>
        <PageHeader
          moreLabel="更多客户操作"
          primaryAction={
            canCreateCustomers
              ? {
                  key: "create-customer",
                  label: "新建客户",
                  onClick: () => navigate("/crm/customers/new"),
                }
              : undefined
          }
          secondaryActions={[
            {
              key: "nearby-customers",
              label: "附近客户",
              onClick: () => navigate("/crm/customers/nearby"),
            },
            ...(canExportCustomers
              ? [{ key: "export-customers", label: "导出 CSV", onClick: openExport }]
              : []),
          ]}
          title="客户管理"
        />
        <FilterBar
          activeFilters={[
            ...(request.keyword
              ? [
                  {
                    key: "keyword",
                    label: `关键词：${request.keyword}`,
                    onClear: () => setKeyword(""),
                  },
                ]
              : []),
            ...(scene === "mine"
              ? [
                  {
                    key: "scene",
                    label: "我负责的客户",
                    onClear: () => setScene("all"),
                  },
                ]
              : []),
            ...(scene === "subordinates"
              ? [
                  {
                    key: "scene",
                    label: "下属负责的客户",
                    onClear: () => setScene("all"),
                  },
                ]
              : []),
            ...(scene === "starred"
              ? [
                  {
                    key: "scene",
                    label: "我关注的客户",
                    onClear: () => setScene("all"),
                  },
                ]
              : []),
            ...(temporaryConditions.length > 0
              ? [
                  {
                    key: "temporary-conditions",
                    label: `高级筛选：${temporaryConditions.length} 条`,
                    onClear: () => setTemporaryConditions([]),
                  },
                ]
              : []),
            ...(sort !== defaultCustomerListSort
              ? [
                  {
                    key: "sort",
                    label: `排序：${customerListSortLabel(sort, listFieldDefinitionsQuery.data ?? [])}`,
                    onClear: () => setSort(defaultCustomerListSort),
                  },
                ]
              : []),
          ]}
          search={{
            label: "搜索客户",
            placeholder: "搜索客户名称或关键词",
            value: request.keyword,
            onSearch: setKeyword,
          }}
          onClearAll={
            request.keyword ||
            scene !== "all" ||
            sort !== defaultCustomerListSort ||
            temporaryConditions.length > 0
              ? clearFilters
              : undefined
          }
        >
          <Space aria-label="客户场景" size="small" wrap>
            <Button type={scene === "all" ? "primary" : "default"} onClick={() => setScene("all")}>
              全部客户
            </Button>
            <Button
              disabled={!authorization?.actorId}
              type={scene === "mine" ? "primary" : "default"}
              onClick={() => setScene("mine")}
            >
              我负责的客户
            </Button>
            <Button
              type={scene === "subordinates" ? "primary" : "default"}
              onClick={() => setScene("subordinates")}
            >
              下属负责的客户
            </Button>
            <Button
              type={scene === "starred" ? "primary" : "default"}
              onClick={() => setScene("starred")}
            >
              我关注的客户
            </Button>
          </Space>
          <Select<CustomerListSort>
            aria-label="客户排序"
            options={customerSortOptions}
            value={sort}
            onChange={setSort}
          />
          <SavedViewControls
            entityLabel="客户"
            objectType="CUSTOMER"
            selection={savedViewSelection}
            onSelectionChange={setSavedView}
            temporaryConditions={temporaryConditions}
            onTemporaryConditionsChange={setTemporaryFilterConditions}
          />
          <ColumnPreferenceControls
            objectType="CUSTOMER"
            options={customerListColumnOptions}
            onVisibleCodesChange={updateVisibleCustomerColumnCodes}
          />
          <Button aria-label="查重" onClick={openDuplicateCheck}>
            查重
          </Button>
        </FilterBar>
        <DataWorkspace
          errorMessage={
            customersQuery.isError
              ? customersQuery.error instanceof ApiError
                ? customersQuery.error.message
                : "客户列表暂时无法加载"
              : undefined
          }
          label="客户数据工作区"
        >
          {batchTagSuccessMessage ? (
            <Typography.Text role="status" type="success">
              {batchTagSuccessMessage}
            </Typography.Text>
          ) : null}
          {batchActivitySuccessMessage ? (
            <Typography.Text role="status" type="success">
              {batchActivitySuccessMessage}
            </Typography.Text>
          ) : null}
          {starMutation.isError ? (
            <Alert
              title={
                starMutation.error instanceof ApiError
                  ? starMutation.error.message
                  : "客户关注状态暂时无法更新"
              }
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            bulkActions={
              <Space>
                {canChangeCustomerTags ? (
                  <Button
                    disabled={selectedCustomers.some((customer) => !hasCustomerVersion(customer))}
                    onClick={openBatchTags}
                  >
                    批量编辑标签
                  </Button>
                ) : null}
                {canComposeActivities ? (
                  <Button onClick={openBatchActivities}>批量写跟进</Button>
                ) : null}
              </Space>
            }
            columns={customerColumns}
            loading={customersQuery.isLoading}
            page={page}
            rowKey={(customer) => customer.id}
            rowSelection={customerRowSelection}
            renderMobileItem={(customer) => (
              <Card
                className={styles.mobileCard}
                size="small"
                title={
                  <Space size="small">
                    <ListStarToggle
                      loading={starMutation.isPending}
                      starred={customer.starred}
                      onToggle={() => toggleCustomerStar(customer)}
                    />
                    <Button
                      data-detail-trigger-id={customer.id}
                      type="link"
                      onClick={() => openCustomer(customer)}
                    >
                      {customer.name}
                    </Button>
                  </Space>
                }
              >
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{customer.phoneNumber ?? "未提供联系电话"}</Typography.Text>
                  {canReadActivities ? (
                    <>
                      <Typography.Text>
                        最后跟进：{formatLastActivityTime(customer.lastActivityTime)}
                      </Typography.Text>
                      <Typography.Text>
                        最后跟进记录：{customer.lastActivityContent ?? "—"}
                      </Typography.Text>
                    </>
                  ) : null}
                  <div className={styles.mobileMeta}>
                    {customer.status ? <Tag>{customer.status}</Tag> : null}
                    {customer.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                </Space>
              </Card>
            )}
            selectedRowCount={selectedCustomers.length}
            onPageChange={setPage}
          />
        </DataWorkspace>
        <Modal
          destroyOnHidden
          footer={
            <>
              <Button disabled={exportMutation.isPending} onClick={closeExport}>
                取消
              </Button>
              <Button
                loading={exportMutation.isPending}
                type="primary"
                onClick={() => exportMutation.mutate()}
              >
                导出 CSV
              </Button>
            </>
          }
          open={exportOpen}
          title="导出客户 CSV"
          onCancel={closeExport}
        >
          <Typography.Paragraph type="secondary">
            {request.keyword
              ? `将导出当前关键词“${request.keyword}”匹配的服务端可见客户。`
              : "将导出当前成员在服务端可见范围内的客户。"}
            {activeSavedView ? ` 将同时应用保存视图“${activeSavedView.name}”。` : ""}
            首期固定导出“客户名称”列，字段和数据范围均由服务端再次校验。
          </Typography.Paragraph>
          {exportMutation.isError ? (
            <Alert
              title={
                exportMutation.error instanceof ApiError
                  ? exportMutation.error.message
                  : "客户导出暂时无法完成"
              }
              showIcon
              style={{ marginTop: 16 }}
              type="error"
            />
          ) : null}
        </Modal>
        <BatchTagModal
          errorMessage={
            batchTagMutation.isError
              ? batchTagMutation.error instanceof ApiError
                ? batchTagMutation.error.message
                : "客户标签暂时无法更新，请稍后重试"
              : undefined
          }
          objectLabel="客户"
          open={batchTagsOpen}
          pending={batchTagMutation.isPending}
          selectedCount={selectedCustomers.length}
          onCancel={closeBatchTags}
          onSubmit={submitBatchTags}
        />
        <BatchActivityModal
          objectLabel="客户"
          open={batchActivitiesOpen}
          subjectIds={selectedCustomers.map((customer) => customer.id)}
          subjectType="CUSTOMER"
          onCancel={closeBatchActivities}
          onSuccess={completeBatchActivities}
        />
        <CustomerListDuplicateCheckModal
          errorMessage={
            duplicateCheckMutation.isError
              ? duplicateCheckMutation.error instanceof ApiError
                ? duplicateCheckMutation.error.message
                : "客户暂时无法查重"
              : undefined
          }
          open={duplicateCheckOpen}
          pending={duplicateCheckMutation.isPending}
          result={duplicateCheckMutation.data}
          onCancel={closeDuplicateCheck}
          onCheck={(values) => duplicateCheckMutation.mutate(values)}
        />
        <CustomerDetailDrawer
          customerId={selectedCustomerId}
          open={selectedCustomerId !== null}
          onClose={closeCustomerDrawer}
        />
      </main>
    </RouteAuthority>
  );
}
