import { useQuery } from "@tanstack/react-query";
import { Button, Select, Space } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { ApiClient } from "~/api/client/api-client";
import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { customerRelationFilter } from "~/components/entity-selector/customer-relation-filter";
import {
  defaultPageRequest,
  normalizePageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";
import {
  ColumnPreferenceControls,
  type ColumnPreferenceOption,
} from "~/components/data-view/column-preference-controls";
import { createFieldMetadataQueryKeys, type FieldDefinition } from "~/components/dynamic-field";
import { DataWorkspace } from "~/components/page/data-workspace";
import { FilterBar } from "~/components/page/filter-bar";
import { PageHeader, type PageHeaderAction } from "~/components/page/page-header";
import { SavedViewControls } from "~/features/saved-views/components/saved-view-controls";
import { savedViewKeys } from "~/features/saved-views/model/query-keys";
import {
  resolveSavedView,
  savedViewSelectionFromSearch,
} from "~/features/saved-views/model/saved-view";
import {
  globalRecordListSceneFromSearch,
  globalRecordListStatusFromSearch,
  withGlobalRecordListScene,
  type GlobalRecordListQuery,
  type GlobalRecordListScene,
  type GlobalRecordListStatusOption,
} from "./global-record-list-scene";
import {
  type GlobalRecordListRelationFilter,
  useGlobalRecordListRelationFilter,
} from "./global-record-list-relation-filter";

interface GlobalRecordListProps<T extends { id: number }, TSummary = never> {
  authority: string;
  advancedFilter?: GlobalRecordListAdvancedFilter;
  columnPreference?: GlobalRecordListColumnPreference;
  columns: ColumnsType<T>;
  contractFilter?: GlobalRecordListRelationFilter;
  customerFilter?: GlobalRecordListCustomerFilter;
  description?: string;
  dynamicFields?: GlobalRecordListDynamicFields<T>;
  errorMessage: string;
  label: string;
  load(apiClient: ApiClient, query: GlobalRecordListQuery): Promise<components["schemas"]["Pager"]>;
  primaryAction?: GlobalRecordListPrimaryAction;
  opportunityFilter?: GlobalRecordListRelationFilter;
  queryKey(identityKey: string, query: GlobalRecordListQuery): readonly unknown[];
  receivablePlanFilter?: GlobalRecordListRelationFilter;
  renderMobileItem(item: T): ReactNode;
  searchLabel: string;
  searchPlaceholder: string;
  selection?: GlobalRecordListSelection<T>;
  sortConfig?: GlobalRecordListSortConfig<string>;
  secondaryActions?: readonly GlobalRecordListPrimaryAction[];
  summary?: GlobalRecordListSummary<TSummary>;
  supportsMine?: boolean;
  supportsSubordinates?: boolean;
  statusOptions?: readonly GlobalRecordListStatusOption[];
  title: string;
  toItem(value: unknown): T | null;
}

/** Renders one server-calculated aggregate using the exact active list filters. */
export interface GlobalRecordListSummary<T> {
  additionalAuthorities?: readonly string[];
  load(apiClient: ApiClient, query: GlobalRecordListQuery): Promise<T>;
  queryKey(identityKey: string, query: GlobalRecordListQuery): readonly unknown[];
  render(summary: T): ReactNode;
}

/** Server-visible customer selector for relation filters already supported by a list contract. */
export interface GlobalRecordListCustomerFilter {
  label?: string;
}

/** Maps a safe static list projection to the server-persisted layout of one object type. */
export interface GlobalRecordListColumnPreference {
  objectType: string;
  options: readonly ColumnPreferenceOption[];
}

/** Enables the shared saved-view and temporary advanced-filter workflow for a list. */
export interface GlobalRecordListAdvancedFilter {
  entityLabel: string;
  objectType: string;
}

/**
 * Opt-in server-published custom columns. Definitions are fetched only for callers with
 * `fields:read`; values still come solely from the server-filtered list response.
 */
export interface GlobalRecordListDynamicFields<T extends { id: number }> {
  columnOptions(fields: readonly FieldDefinition[]): readonly ColumnPreferenceOption[];
  columns(fields: readonly FieldDefinition[]): ColumnsType<T>;
  objectType: string;
}

export interface GlobalRecordListSortConfig<TSort extends string> {
  defaultSort: TSort;
  fromSearch(search: string): TSort;
  label(sort: TSort, fields?: readonly FieldDefinition[]): string;
  options: readonly { label: string; value: TSort }[];
  customOptions?(fields: readonly FieldDefinition[]): readonly { label: string; value: TSort }[];
  resolve?(sort: TSort, fields: readonly FieldDefinition[]): TSort;
  withSort(query: GlobalRecordListQuery, sort: TSort): GlobalRecordListQuery;
}

/** A page action remains hidden unless its independent write authority is granted. */
export interface GlobalRecordListPrimaryAction extends Omit<PageHeaderAction, "onClick"> {
  additionalAuthorities?: readonly string[];
  authority: string;
  onClick(query: GlobalRecordListQuery): void;
}

/**
 * Opt-in desktop row selection for operations that act on the exact server-provided list rows.
 * The caller owns the operation authority and can clear selection after a successful mutation.
 */
export interface GlobalRecordListSelection<T extends { id: number }> {
  renderActions(selectedItems: readonly T[]): ReactNode;
  resetKey?: string | number;
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

export function GlobalRecordList<T extends { id: number }, TSummary = never>({
  authority,
  advancedFilter,
  columnPreference,
  columns,
  contractFilter,
  customerFilter,
  description,
  dynamicFields,
  errorMessage,
  label,
  load,
  primaryAction,
  opportunityFilter,
  queryKey,
  receivablePlanFilter,
  renderMobileItem,
  searchLabel,
  searchPlaceholder,
  selection,
  sortConfig,
  secondaryActions,
  summary,
  supportsMine = false,
  supportsSubordinates = false,
  statusOptions = [],
  title,
  toItem,
}: Readonly<GlobalRecordListProps<T, TSummary>>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [visibleColumnCodes, setVisibleColumnCodes] = useState<readonly string[]>(
    () => columnPreference?.options.map((option) => option.code) ?? [],
  );
  const [selectionState, setSelectionState] = useState<{
    items: readonly T[];
    scope: string;
  }>({ items: [], scope: "" });
  const search = searchParams.toString();
  const scene = globalRecordListSceneFromSearch(search, supportsMine, supportsSubordinates);
  const status = globalRecordListStatusFromSearch(search, statusOptions);
  const canReadCustomers = hasAuthority(authorization, "customers:read");
  const identityKey = authState?.identityKey ?? "pending";
  const canRead = hasAuthority(authorization, authority);
  const canReadFieldMetadata = hasAuthority(authorization, "fields:read");
  const fieldDefinitionsQuery = useQuery({
    queryKey:
      dynamicFields === undefined
        ? ["field-definitions", "disabled"]
        : createFieldMetadataQueryKeys(identityKey, dynamicFields.objectType, "fields:read")
            .definitions,
    queryFn: () =>
      apiClient === null || dynamicFields === undefined
        ? Promise.reject(new Error("字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions(dynamicFields.objectType),
    enabled: apiClient !== null && dynamicFields !== undefined && canRead && canReadFieldMetadata,
  });
  const fieldDefinitions = useMemo(
    () => fieldDefinitionsQuery.data ?? [],
    [fieldDefinitionsQuery.data],
  );
  const requestedSort = sortConfig?.fromSearch(search);
  const sort =
    requestedSort === undefined || sortConfig === undefined
      ? undefined
      : (sortConfig.resolve?.(requestedSort, fieldDefinitions) ?? requestedSort);
  const columnOptions = useMemo(
    () => [
      ...(columnPreference?.options ?? []),
      ...(dynamicFields?.columnOptions(fieldDefinitions) ?? []),
    ],
    [columnPreference?.options, dynamicFields, fieldDefinitions],
  );
  const [temporaryConditions, setTemporaryConditions] = useState<
    components["schemas"]["FilterConditionRequest"][]
  >([]);
  const canReadSavedViews = hasAuthority(authorization, "saved-views:read");
  const savedViewSelection = useMemo(() => savedViewSelectionFromSearch(search), [search]);
  const savedViewsQuery = useQuery({
    queryKey:
      advancedFilter === undefined
        ? ["saved-views", "disabled"]
        : savedViewKeys.list(identityKey, advancedFilter.objectType, true),
    queryFn: () =>
      apiClient === null || advancedFilter === undefined
        ? Promise.reject(new Error("保存视图暂时不可用。"))
        : apiClient.listSavedViews(advancedFilter.objectType, true),
    enabled: apiClient !== null && advancedFilter !== undefined && canReadSavedViews,
  });
  const activeSavedView = resolveSavedView(savedViewsQuery.data ?? [], savedViewSelection);
  const availablePrimaryAction =
    primaryAction !== undefined &&
    hasAuthority(authorization, primaryAction.authority) &&
    (primaryAction.additionalAuthorities ?? []).every((requiredAuthority) =>
      hasAuthority(authorization, requiredAuthority),
    )
      ? primaryAction
      : undefined;
  const availableSecondaryActions = (secondaryActions ?? []).filter(
    (action) =>
      hasAuthority(authorization, action.authority) &&
      (action.additionalAuthorities ?? []).every((requiredAuthority) =>
        hasAuthority(authorization, requiredAuthority),
      ),
  );
  const customerRelationFilterConfig: GlobalRecordListRelationFilter | undefined =
    customerFilter === undefined
      ? undefined
      : {
          ...customerRelationFilter,
          label: customerFilter.label ?? customerRelationFilter.label,
        };
  const customerRelation = useGlobalRecordListRelationFilter({
    apiClient,
    canUse: canReadCustomers,
    filter: customerRelationFilterConfig,
    identityKey,
    searchParams,
    setSearchParams,
  });
  const contractRelation = useGlobalRecordListRelationFilter({
    apiClient,
    canUse:
      contractFilter !== undefined &&
      hasAuthority(authorization, contractFilter.authority) &&
      (contractFilter.additionalAuthorities ?? []).every((requiredAuthority) =>
        hasAuthority(authorization, requiredAuthority),
      ),
    filter: contractFilter,
    identityKey,
    searchParams,
    setSearchParams,
  });
  const receivablePlanRelation = useGlobalRecordListRelationFilter({
    apiClient,
    canUse:
      receivablePlanFilter !== undefined &&
      hasAuthority(authorization, receivablePlanFilter.authority) &&
      (receivablePlanFilter.additionalAuthorities ?? []).every((requiredAuthority) =>
        hasAuthority(authorization, requiredAuthority),
      ),
    filter: receivablePlanFilter,
    identityKey,
    searchParams,
    setSearchParams,
  });
  const opportunityRelation = useGlobalRecordListRelationFilter({
    apiClient,
    canUse:
      opportunityFilter !== undefined &&
      hasAuthority(authorization, opportunityFilter.authority) &&
      (opportunityFilter.additionalAuthorities ?? []).every((requiredAuthority) =>
        hasAuthority(authorization, requiredAuthority),
      ),
    filter: opportunityFilter,
    identityKey,
    searchParams,
    setSearchParams,
  });
  const request = useMemo(() => {
    const params = new URLSearchParams(search);
    const page = normalizePageRequest({
      page: Number.parseInt(params.get("page") ?? "", 10),
      size: Number.parseInt(params.get("size") ?? "", 10),
    });
    const keyword = params.get("keyword")?.trim();
    const query = withGlobalRecordListScene(
      {
        ...page,
        contractId: contractRelation.confirmedId,
        customerId: customerRelation.confirmedId,
        keyword: keyword || undefined,
        opportunityId: opportunityRelation.confirmedId,
        receivablePlanId: receivablePlanRelation.confirmedId,
        status,
        ...(advancedFilter === undefined
          ? {}
          : temporaryConditions.length > 0
            ? { conditions: temporaryConditions }
            : { savedViewId: activeSavedView?.id }),
      },
      scene,
      authorization?.actorId,
    );
    return sortConfig === undefined || sort === undefined
      ? query
      : sortConfig.withSort(query, sort);
  }, [
    authorization?.actorId,
    activeSavedView?.id,
    advancedFilter,
    contractRelation.confirmedId,
    customerRelation.confirmedId,
    opportunityRelation.confirmedId,
    receivablePlanRelation.confirmedId,
    scene,
    search,
    sort,
    sortConfig,
    status,
    temporaryConditions,
  ]);
  const recordsQuery = useQuery({
    queryKey: queryKey(identityKey, request),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error(`${label} API is unavailable.`))
        : load(apiClient, request),
    enabled:
      apiClient !== null &&
      canRead &&
      customerRelation.ready &&
      contractRelation.ready &&
      opportunityRelation.ready &&
      receivablePlanRelation.ready,
  });
  const canReadSummary =
    summary !== undefined &&
    (summary.additionalAuthorities ?? []).every((requiredAuthority) =>
      hasAuthority(authorization, requiredAuthority),
    );
  const summaryQuery = useQuery({
    queryKey:
      summary === undefined
        ? ["global-record-list", "summary", "disabled"]
        : summary.queryKey(identityKey, request),
    queryFn: () =>
      apiClient === null || summary === undefined
        ? Promise.reject(new Error(`${label} 汇总 API 暂时不可用。`))
        : summary.load(apiClient, request),
    enabled:
      apiClient !== null &&
      canRead &&
      canReadSummary &&
      customerRelation.ready &&
      contractRelation.ready &&
      opportunityRelation.ready &&
      receivablePlanRelation.ready,
  });
  const page: PageResult<T> = recordsQuery.data
    ? toPageResult(recordsQuery.data, toItem)
    : { ...defaultPageRequest, items: [], meta: {}, total: null };
  const selectionScope = JSON.stringify([identityKey, request, selection?.resetKey]);
  const selectedItems =
    selectionState.scope === selectionScope ? selectionState.items : ([] as readonly T[]);
  const rowSelection: TableProps<T>["rowSelection"] =
    selection === undefined
      ? undefined
      : {
          onChange: (_selectedRowKeys, rows) =>
            setSelectionState({ items: rows, scope: selectionScope }),
          selectedRowKeys: selectedItems.map((item) => item.id),
        };
  const visibleColumns = useMemo(() => {
    const sourceColumns = [...columns, ...(dynamicFields?.columns(fieldDefinitions) ?? [])];
    if (columnPreference === undefined) return sourceColumns;

    const columnsByCode = new Map(
      sourceColumns.flatMap((column) =>
        column.key === undefined ? [] : [[String(column.key), column] as const],
      ),
    );
    return visibleColumnCodes.flatMap((code) => {
      const column = columnsByCode.get(code);
      return column === undefined ? [] : [column];
    });
  }, [columnPreference, columns, dynamicFields, fieldDefinitions, visibleColumnCodes]);

  const updateVisibleColumnCodes = useCallback(
    (codes: readonly string[]) => {
      setVisibleColumnCodes((current) =>
        current.length === codes.length && current.every((code, index) => code === codes[index])
          ? current
          : codes,
      );
    },
    [setVisibleColumnCodes],
  );

  function setPage(nextPage: number, nextSize: number) {
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function setKeyword(keyword: string) {
    setSearchParams(updateSearch(searchParams, { keyword: keyword.trim() || undefined, page: 1 }));
  }

  function setScene(nextScene: GlobalRecordListScene) {
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        scene: nextScene === "all" ? undefined : nextScene,
      }),
    );
  }

  function setStatus(nextStatus: string | undefined) {
    setSearchParams(updateSearch(searchParams, { page: 1, status: nextStatus }));
  }

  function setSort(nextSort: string) {
    if (sortConfig === undefined) return;
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        sort: nextSort === sortConfig.defaultSort ? undefined : nextSort,
      }),
    );
  }

  function setSavedView(selection: number | null) {
    setTemporaryConditions([]);
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        savedView: selection === null ? "all" : selection,
      }),
    );
  }

  function setTemporaryFilterConditions(
    conditions: components["schemas"]["FilterConditionRequest"][],
  ) {
    setTemporaryConditions(conditions);
    setSearchParams(updateSearch(searchParams, { page: 1, savedView: "all" }));
  }

  const selectedStatus = statusOptions.find((option) => option.value === status);
  const sceneControls =
    supportsMine || supportsSubordinates ? (
      <Space aria-label={`${title}场景`} size="small" wrap>
        <Button type={scene === "all" ? "primary" : "default"} onClick={() => setScene("all")}>
          全部
        </Button>
        {supportsMine ? (
          <Button
            disabled={!authorization?.actorId}
            type={scene === "mine" ? "primary" : "default"}
            onClick={() => setScene("mine")}
          >
            我负责的
          </Button>
        ) : null}
        {supportsSubordinates ? (
          <Button
            type={scene === "subordinates" ? "primary" : "default"}
            onClick={() => setScene("subordinates")}
          >
            下属负责的
          </Button>
        ) : null}
      </Space>
    ) : null;
  const statusControls =
    statusOptions.length > 0 ? (
      <Space aria-label={`${title}状态`} size="small" wrap>
        <Button
          type={status === undefined ? "primary" : "default"}
          onClick={() => setStatus(undefined)}
        >
          全部状态
        </Button>
        {statusOptions.map((option) => (
          <Button
            key={option.value}
            type={status === option.value ? "primary" : "default"}
            onClick={() => setStatus(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </Space>
    ) : null;
  const sortControls =
    sortConfig === undefined || sort === undefined ? null : (
      <Select
        aria-label={`${title}排序`}
        options={[...sortConfig.options, ...(sortConfig.customOptions?.(fieldDefinitions) ?? [])]}
        value={sort}
        onChange={setSort}
      />
    );
  const customerControls = customerRelation.controls;
  const contractControls = contractRelation.controls;
  const opportunityControls = opportunityRelation.controls;
  const receivablePlanControls = receivablePlanRelation.controls;
  const columnPreferenceControls =
    columnPreference === undefined ? null : (
      <ColumnPreferenceControls
        objectType={columnPreference.objectType}
        options={columnOptions}
        onVisibleCodesChange={updateVisibleColumnCodes}
      />
    );
  const advancedFilterControls =
    advancedFilter === undefined ? null : (
      <SavedViewControls
        entityLabel={advancedFilter.entityLabel}
        objectType={advancedFilter.objectType}
        selection={savedViewSelection}
        temporaryConditions={temporaryConditions}
        onSelectionChange={setSavedView}
        onTemporaryConditionsChange={setTemporaryFilterConditions}
      />
    );
  const relationErrorMessage =
    customerRelation.error instanceof ApiError
      ? customerRelation.error.message
      : customerRelation.error !== undefined
        ? "所选客户暂时无法确认，请重新选择"
        : contractRelation.error instanceof ApiError
          ? contractRelation.error.message
          : contractRelation.error !== undefined
            ? "所选合同暂时无法确认，请重新选择"
            : opportunityRelation.error instanceof ApiError
              ? opportunityRelation.error.message
              : opportunityRelation.error !== undefined
                ? "所选商机暂时无法确认，请重新选择"
                : receivablePlanRelation.error instanceof ApiError
                  ? receivablePlanRelation.error.message
                  : receivablePlanRelation.error !== undefined
                    ? "所选回款计划暂时无法确认，请重新选择"
                    : undefined;
  return (
    <RouteAuthority authority={authority}>
      <main>
        <PageHeader
          description={description}
          primaryAction={
            availablePrimaryAction === undefined
              ? undefined
              : {
                  ...availablePrimaryAction,
                  onClick: () => availablePrimaryAction.onClick(request),
                }
          }
          secondaryActions={availableSecondaryActions.map((action) => ({
            ...action,
            onClick: () => action.onClick(request),
          }))}
          title={title}
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
              ? [{ key: "scene", label: "我负责的", onClear: () => setScene("all") }]
              : []),
            ...(scene === "subordinates"
              ? [{ key: "scene", label: "下属负责的", onClear: () => setScene("all") }]
              : []),
            ...(selectedStatus
              ? [
                  {
                    key: "status",
                    label: `状态：${selectedStatus.label}`,
                    onClear: () => setStatus(undefined),
                  },
                ]
              : []),
            ...(temporaryConditions.length === 0
              ? []
              : [
                  {
                    key: "temporary-advanced-filter",
                    label: "高级筛选（" + temporaryConditions.length + "）",
                    onClear: () => setTemporaryFilterConditions([]),
                  },
                ]),
            ...(customerRelation.activeFilter === undefined ? [] : [customerRelation.activeFilter]),
            ...(contractRelation.activeFilter === undefined ? [] : [contractRelation.activeFilter]),
            ...(opportunityRelation.activeFilter === undefined
              ? []
              : [opportunityRelation.activeFilter]),
            ...(receivablePlanRelation.activeFilter === undefined
              ? []
              : [receivablePlanRelation.activeFilter]),
            ...(sortConfig !== undefined && sort !== undefined && sort !== sortConfig.defaultSort
              ? [
                  {
                    key: "sort",
                    label: `排序：${sortConfig.label(sort, fieldDefinitions)}`,
                    onClear: () => setSort(sortConfig.defaultSort),
                  },
                ]
              : []),
          ]}
          search={{
            label: searchLabel,
            placeholder: searchPlaceholder,
            value: request.keyword,
            onSearch: setKeyword,
          }}
          trailing={
            sceneControls ||
            statusControls ||
            sortControls ||
            customerControls ||
            contractControls ||
            opportunityControls ||
            receivablePlanControls ||
            advancedFilterControls ||
            columnPreferenceControls ? (
              <Space size="small" wrap>
                {sceneControls}
                {statusControls}
                {sortControls}
                {customerControls}
                {contractControls}
                {opportunityControls}
                {receivablePlanControls}
                {advancedFilterControls}
                {columnPreferenceControls}
              </Space>
            ) : undefined
          }
          onClearAll={
            request.keyword ||
            scene !== "all" ||
            status !== undefined ||
            customerRelation.activeFilter !== undefined ||
            contractRelation.activeFilter !== undefined ||
            opportunityRelation.activeFilter !== undefined ||
            receivablePlanRelation.activeFilter !== undefined ||
            temporaryConditions.length > 0 ||
            (sortConfig !== undefined && sort !== undefined && sort !== sortConfig.defaultSort)
              ? () => {
                  setTemporaryConditions([]);
                  setSearchParams(new URLSearchParams("savedView=all"));
                }
              : undefined
          }
        />
        <DataWorkspace
          errorMessage={
            relationErrorMessage ??
            (recordsQuery.isError
              ? recordsQuery.error instanceof ApiError
                ? recordsQuery.error.message
                : errorMessage
              : undefined)
          }
          label={label}
        >
          <ResponsiveDataList
            bulkActions={
              selection === undefined ? undefined : selection.renderActions(selectedItems)
            }
            columns={visibleColumns}
            label={title}
            loading={recordsQuery.isLoading}
            page={page}
            rowKey={(item) => item.id}
            rowSelection={rowSelection}
            renderMobileItem={renderMobileItem}
            selectedRowCount={selectedItems.length}
            onPageChange={setPage}
          />
          {summary !== undefined && summaryQuery.data !== undefined
            ? summary.render(summaryQuery.data)
            : null}
        </DataWorkspace>
        {customerRelation.modal}
        {contractRelation.modal}
        {opportunityRelation.modal}
        {receivablePlanRelation.modal}
      </main>
    </RouteAuthority>
  );
}
