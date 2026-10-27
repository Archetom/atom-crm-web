import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { customerRelationFilter } from "~/components/entity-selector/customer-relation-filter";
import { useGlobalRecordListRelationFilter } from "~/components/data-view/global-record-list-relation-filter";
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
import {
  defaultPageRequest,
  normalizePageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";
import { DataWorkspace } from "~/components/page/data-workspace";
import { FilterBar } from "~/components/page/filter-bar";
import { PageHeader } from "~/components/page/page-header";
import { BatchActivityModal } from "~/features/activities";
import { SavedViewControls } from "~/features/saved-views";
import { savedViewKeys } from "~/features/saved-views";
import { resolveSavedView, savedViewSelectionFromSearch } from "~/features/saved-views";
import { formatServerAmount } from "~/shared/utils/format-server-amount";

import { toOpportunityListItem, type OpportunityListItem } from "../model/opportunity-list-item";
import { selectedOpportunityIdFromSearch } from "../model/opportunity-list-route";
import { OpportunityDetailDrawer } from "../components/opportunity-detail-drawer";
import {
  opportunityListSceneFromSearch,
  withOpportunityListScene,
  type OpportunityListScene,
} from "../model/opportunity-list-scene";
import {
  defaultOpportunityListSort,
  opportunityCustomSortOptions,
  opportunityListSortFromSearch,
  opportunityListSortLabel,
  opportunityListSortOptions,
  resolveOpportunityListSort,
  withOpportunityListSort,
  type OpportunityListSort,
} from "../model/opportunity-list-sort";
import { opportunityKeys } from "../model/query-keys";

import styles from "./opportunity-list-page.module.css";

type VersionedOpportunityListItem = OpportunityListItem & { version: number };

function hasOpportunityVersion(
  opportunity: OpportunityListItem,
): opportunity is VersionedOpportunityListItem {
  return (
    typeof opportunity.version === "number" &&
    Number.isSafeInteger(opportunity.version) &&
    opportunity.version >= 0
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

function formatNextContactTime(value: string | null): string {
  return value === null ? "—" : value.replace("T", " ").slice(0, 16);
}

function renderDescription(value: string | null) {
  return value === null ? (
    "—"
  ) : (
    <Typography.Text ellipsis={{ tooltip: value }}>{value}</Typography.Text>
  );
}

function columns(
  onOpen: (opportunity: OpportunityListItem) => void,
  onToggleStar: (opportunity: OpportunityListItem) => void,
  isStarUpdatePending: boolean,
  canReadActivities: boolean,
): ColumnsType<OpportunityListItem> {
  return [
    {
      dataIndex: "name",
      key: "opportunity_name",
      title: "商机名称",
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
      dataIndex: "customerId",
      key: "customer",
      title: "关联客户",
      render: (value: number | null) => (value === null ? "—" : `客户 ${value}`),
    },
    {
      dataIndex: "estimatedAmount",
      key: "estimated_amount",
      title: "商机金额",
      render: (value: number | null) => formatServerAmount(value),
    },
    {
      dataIndex: "expectedCloseDate",
      key: "expected_close_date",
      title: "预计成交日期",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "description",
      key: "description",
      title: "备注",
      width: 180,
      render: renderDescription,
    },
    {
      dataIndex: "nextContactTime",
      key: "next_contact_time",
      title: "下次联系时间",
      render: formatNextContactTime,
    },
    ...(canReadActivities
      ? [
          {
            dataIndex: "lastActivityTime",
            key: "last_activity_time",
            title: "最后跟进时间",
            render: formatNextContactTime,
          },
        ]
      : []),
    {
      dataIndex: "ownerActorId",
      key: "owner_actor",
      title: "负责人",
      render: (value: number | null) => (value === null ? "—" : `成员 ${value}`),
    },
    {
      key: "stage_code",
      title: "销售阶段",
      render: (_, item) =>
        item.pipelineCode === null || item.stageCode === null
          ? "—"
          : `${item.pipelineCode} / ${item.stageCode}`,
    },
    {
      dataIndex: "outcome",
      key: "outcome",
      title: "结果",
      render: (value: string | null) => value ?? "—",
    },
    {
      fixed: "right",
      key: "actions",
      title: "操作",
      width: 88,
      render: (_, opportunity) => (
        <Button
          data-detail-trigger-id={opportunity.id}
          type="link"
          onClick={() => onOpen(opportunity)}
        >
          查看
        </Button>
      ),
    },
  ];
}

const baseOpportunityColumnOptions: readonly ColumnPreferenceOption[] = [
  { code: "opportunity_name", label: "商机名称" },
  { code: "customer", label: "关联客户" },
  { code: "estimated_amount", label: "商机金额" },
  { code: "expected_close_date", label: "预计成交日期" },
  { code: "description", label: "备注" },
  { code: "next_contact_time", label: "下次联系时间" },
  { code: "owner_actor", label: "负责人" },
  { code: "stage_code", label: "销售阶段" },
  { code: "outcome", label: "结果" },
];

const activityOpportunityColumnOptions: readonly ColumnPreferenceOption[] = [
  { code: "last_activity_time", label: "最后跟进时间" },
];

const allOpportunityColumnOptions: readonly ColumnPreferenceOption[] = [
  ...baseOpportunityColumnOptions,
  ...activityOpportunityColumnOptions,
];

export function OpportunityListPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedOpportunities, setSelectedOpportunities] = useState<OpportunityListItem[]>([]);
  const [batchOwnerPickerOpen, setBatchOwnerPickerOpen] = useState(false);
  const [batchOwnerKeyword, setBatchOwnerKeyword] = useState("");
  const [batchOwnerTargets, setBatchOwnerTargets] = useState<
    readonly VersionedOpportunityListItem[]
  >([]);
  const [batchActionSuccessMessage, setBatchActionSuccessMessage] = useState<string | null>(null);
  const [batchActivitiesOpen, setBatchActivitiesOpen] = useState(false);
  const [batchActivitySuccessMessage, setBatchActivitySuccessMessage] = useState<string | null>(
    null,
  );
  const [temporaryConditions, setTemporaryConditions] = useState<
    components["schemas"]["FilterConditionRequest"][]
  >([]);
  const [visibleOpportunityColumnCodes, setVisibleOpportunityColumnCodes] = useState<
    readonly string[]
  >(() => allOpportunityColumnOptions.map((option) => option.code));
  const search = searchParams.toString();
  const selectedOpportunityId = useMemo(() => selectedOpportunityIdFromSearch(search), [search]);
  const scene = opportunityListSceneFromSearch(search);
  const requestedSort = opportunityListSortFromSearch(search);
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
  const canAssignOpportunities = hasAuthority(authorization, authority.opportunitiesAssign);
  const canDeleteOpportunities = hasAuthority(authorization, authority.opportunitiesDelete);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canBatchTransfer = canAssignOpportunities && canReadOrganization;
  const canReadActivities = hasAuthority(authorization, authority.activitiesRead);
  const canComposeActivities =
    canReadActivities && hasAuthority(authorization, authority.activitiesWrite);
  const customerRelation = useGlobalRecordListRelationFilter({
    apiClient,
    canUse: hasAuthority(authorization, authority.customersRead),
    filter: customerRelationFilter,
    identityKey,
    searchParams,
    setSearchParams,
  });
  const canReadSavedViews = hasAuthority(authorization, authority.savedViewsRead);
  const canReadListFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const opportunityColumnOptions = useMemo(
    () => (canReadActivities ? allOpportunityColumnOptions : baseOpportunityColumnOptions),
    [canReadActivities],
  );
  const listFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "OPPORTUNITY", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("OPPORTUNITY"),
    enabled: apiClient !== null && canReadListFieldMetadata,
  });
  const opportunityListColumnOptions = useMemo(
    () => [
      ...opportunityColumnOptions,
      ...dynamicListColumnOptions(
        listFieldDefinitionsQuery.data ?? [],
        opportunityColumnOptions.map((option) => option.code),
      ),
    ],
    [listFieldDefinitionsQuery.data, opportunityColumnOptions],
  );
  const sort = useMemo(
    () => resolveOpportunityListSort(requestedSort, listFieldDefinitionsQuery.data ?? []),
    [listFieldDefinitionsQuery.data, requestedSort],
  );
  const opportunitySortOptions = useMemo(
    () => [
      ...opportunityListSortOptions,
      ...opportunityCustomSortOptions(listFieldDefinitionsQuery.data ?? []),
    ],
    [listFieldDefinitionsQuery.data],
  );
  const savedViewSelection = useMemo(() => savedViewSelectionFromSearch(search), [search]);
  const savedViewsQuery = useQuery({
    queryKey: savedViewKeys.list(identityKey, "OPPORTUNITY", true),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("保存视图暂时不可用。"))
        : apiClient.listSavedViews("OPPORTUNITY", true),
    enabled: apiClient !== null && canReadSavedViews,
  });
  const activeSavedView = resolveSavedView(savedViewsQuery.data ?? [], savedViewSelection);
  const opportunityRequest = useMemo(
    () =>
      withOpportunityListSort(
        withOpportunityListScene(
          {
            ...request,
            customerId: customerRelation.confirmedId,
            ...(temporaryConditions.length > 0
              ? { conditions: temporaryConditions }
              : { savedViewId: activeSavedView?.id }),
          },
          scene,
          authorization?.actorId,
        ),
        sort,
      ),
    [
      activeSavedView?.id,
      authorization?.actorId,
      customerRelation.confirmedId,
      request,
      scene,
      sort,
      temporaryConditions,
    ],
  );
  const opportunitiesQuery = useQuery({
    queryKey:
      temporaryConditions.length > 0
        ? opportunityKeys.temporaryFilteredList(identityKey, opportunityRequest)
        : opportunityKeys.listRequest(identityKey, opportunityRequest),
    queryFn: () =>
      apiClient?.getOpportunities(opportunityRequest) ??
      Promise.reject(new Error("Opportunities API is unavailable.")),
    enabled: apiClient !== null && customerRelation.ready,
  });
  const memberQuery = useQuery({
    queryKey: [
      "member-selector",
      "opportunity-batch-owner",
      identityKey,
      batchOwnerKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity owner selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: batchOwnerKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && batchOwnerPickerOpen && canReadOrganization,
  });
  const opportunitySummaryQuery = useQuery({
    queryKey: opportunityKeys.summary(identityKey, opportunityRequest),
    queryFn: () =>
      apiClient?.getOpportunitySummary(opportunityRequest) ??
      Promise.reject(new Error("商机汇总 API 暂时不可用。")),
    enabled: apiClient !== null && customerRelation.ready,
  });
  const starMutation = useMutation({
    mutationFn: ({ opportunityId, starred }: { opportunityId: number; starred: boolean }) =>
      apiClient === null
        ? Promise.reject(new Error("商机关注 API 暂时不可用。"))
        : apiClient.setOpportunityStarred(opportunityId, { starred }),
    onSuccess: async (_, { opportunityId }) => {
      await queryClient.invalidateQueries({
        queryKey: opportunityKeys.detail(identityKey, opportunityId),
      });
      await queryClient.invalidateQueries({ queryKey: opportunityKeys.lists(identityKey) });
    },
  });
  const batchOwnerMutation = useMutation({
    mutationFn: ({
      actorId,
      opportunities,
    }: {
      actorId: number;
      opportunities: readonly VersionedOpportunityListItem[];
    }) =>
      apiClient === null || opportunities.length === 0
        ? Promise.reject(new Error("Opportunity owner batch update is unavailable."))
        : apiClient.updateOpportunityOwners({
            ownerActorId: actorId,
            opportunities: opportunities.map((opportunity) => ({
              opportunityId: opportunity.id,
              version: opportunity.version,
            })),
          }),
    onSuccess: (_, { opportunities }) => {
      setSelectedOpportunities([]);
      setBatchOwnerPickerOpen(false);
      setBatchOwnerKeyword("");
      setBatchOwnerTargets([]);
      setBatchActionSuccessMessage(`已转移 ${opportunities.length} 条商机。`);
      void queryClient.invalidateQueries({ queryKey: opportunityKeys.all });
    },
  });
  const batchDeleteMutation = useMutation({
    mutationFn: (opportunities: readonly VersionedOpportunityListItem[]) =>
      apiClient === null || opportunities.length === 0
        ? Promise.reject(new Error("Opportunity batch deletion is unavailable."))
        : apiClient.deleteOpportunities({
            opportunities: opportunities.map((opportunity) => ({
              opportunityId: opportunity.id,
              version: opportunity.version,
            })),
          }),
    onSuccess: (_, opportunities) => {
      setSelectedOpportunities([]);
      setBatchActionSuccessMessage(`已删除 ${opportunities.length} 条商机。`);
      void queryClient.invalidateQueries({ queryKey: opportunityKeys.all });
    },
  });
  const page: PageResult<OpportunityListItem> = opportunitiesQuery.data
    ? toPageResult(opportunitiesQuery.data, toOpportunityListItem)
    : { ...defaultPageRequest, items: [], total: null, meta: {} };
  const openOpportunity = useCallback(
    (opportunity: OpportunityListItem) => {
      setSearchParams(updateSearch(searchParams, { opportunityId: opportunity.id }));
    },
    [searchParams, setSearchParams],
  );
  const closeOpportunityDrawer = useCallback(() => {
    setSearchParams(updateSearch(searchParams, { opportunityId: undefined }));
  }, [searchParams, setSearchParams]);
  const toggleOpportunityStar = useCallback(
    (opportunity: OpportunityListItem) =>
      starMutation.mutate({ opportunityId: opportunity.id, starred: !opportunity.starred }),
    [starMutation],
  );
  const visibleColumns = useMemo(() => {
    const source = [
      ...columns(openOpportunity, toggleOpportunityStar, starMutation.isPending, canReadActivities),
      ...dynamicListColumns<OpportunityListItem>(
        listFieldDefinitionsQuery.data ?? [],
        opportunityColumnOptions.map((option) => option.code),
      ),
    ];
    const byCode = new Map(source.map((column) => [String(column.key), column]));
    const visible = visibleOpportunityColumnCodes.flatMap((code) => {
      const column = byCode.get(code);
      return column === undefined ? [] : [column];
    });
    const action = byCode.get("actions");
    return action === undefined ? visible : [...visible, action];
  }, [
    canReadActivities,
    listFieldDefinitionsQuery.data,
    openOpportunity,
    opportunityColumnOptions,
    starMutation.isPending,
    toggleOpportunityStar,
    visibleOpportunityColumnCodes,
  ]);
  const updateVisibleOpportunityColumnCodes = useCallback((codes: readonly string[]) => {
    setVisibleOpportunityColumnCodes((current) =>
      current.length === codes.length && current.every((code, index) => code === codes[index])
        ? current
        : codes,
    );
  }, []);

  function setPage(nextPage: number, nextSize: number) {
    setSelectedOpportunities([]);
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function setKeyword(keyword: string) {
    setSelectedOpportunities([]);
    setSearchParams(updateSearch(searchParams, { keyword: keyword.trim() || undefined, page: 1 }));
  }

  function setScene(nextScene: OpportunityListScene) {
    setSelectedOpportunities([]);
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        scene: nextScene === "all" ? undefined : nextScene,
      }),
    );
  }

  function setSort(nextSort: OpportunityListSort) {
    setSelectedOpportunities([]);
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        sort: nextSort === defaultOpportunityListSort ? undefined : nextSort,
      }),
    );
  }

  function setSavedView(selection: number | null) {
    setSelectedOpportunities([]);
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
    setSelectedOpportunities([]);
    setTemporaryConditions(conditions);
  }

  function clearFilters() {
    setSelectedOpportunities([]);
    setTemporaryConditions([]);
    setSearchParams(
      updateSearch(searchParams, {
        keyword: undefined,
        customerId: undefined,
        page: 1,
        scene: undefined,
        sort: undefined,
      }),
    );
  }

  function openBatchActivities() {
    setBatchActivitiesOpen(true);
  }

  function closeBatchActivities() {
    setBatchActivitiesOpen(false);
  }

  function completeBatchActivities(createdCount: number) {
    setSelectedOpportunities([]);
    setBatchActivitiesOpen(false);
    setBatchActivitySuccessMessage(`已为 ${createdCount} 条商机批量记录跟进。`);
  }

  function openBatchOwnerPicker() {
    const opportunities = selectedOpportunities.filter(hasOpportunityVersion);
    if (opportunities.length !== selectedOpportunities.length || opportunities.length === 0) return;
    batchOwnerMutation.reset();
    setBatchOwnerTargets(opportunities);
    setBatchOwnerPickerOpen(true);
  }

  function closeBatchOwnerPicker() {
    if (batchOwnerMutation.isPending) return;
    batchOwnerMutation.reset();
    setBatchOwnerPickerOpen(false);
    setBatchOwnerKeyword("");
    setBatchOwnerTargets([]);
  }

  function deleteSelectedOpportunities() {
    const opportunities = selectedOpportunities.filter(hasOpportunityVersion);
    if (opportunities.length !== selectedOpportunities.length || opportunities.length === 0) return;
    batchDeleteMutation.reset();
    batchDeleteMutation.mutate(opportunities);
  }

  const opportunityRowSelection: TableProps<OpportunityListItem>["rowSelection"] =
    canComposeActivities || canBatchTransfer || canDeleteOpportunities
      ? {
          selectedRowKeys: selectedOpportunities.map((opportunity) => opportunity.id),
          getCheckboxProps: (opportunity) => ({
            disabled: !canComposeActivities && !hasOpportunityVersion(opportunity),
          }),
          onChange: (_, opportunities) => setSelectedOpportunities(opportunities),
        }
      : undefined;

  return (
    <RouteAuthority authority={authority.opportunitiesRead}>
      <main>
        <PageHeader title="商机管理" />
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
              ? [{ key: "scene", label: "我负责的商机", onClear: () => setScene("all") }]
              : []),
            ...(scene === "starred"
              ? [{ key: "scene", label: "我关注的商机", onClear: () => setScene("all") }]
              : []),
            ...(scene === "won"
              ? [{ key: "scene", label: "赢单商机", onClear: () => setScene("all") }]
              : []),
            ...(scene === "lost"
              ? [{ key: "scene", label: "输单商机", onClear: () => setScene("all") }]
              : []),
            ...(scene === "invalid"
              ? [{ key: "scene", label: "无效商机", onClear: () => setScene("all") }]
              : []),
            ...(customerRelation.activeFilter === undefined ? [] : [customerRelation.activeFilter]),
            ...(temporaryConditions.length > 0
              ? [
                  {
                    key: "temporary-conditions",
                    label: `高级筛选：${temporaryConditions.length} 条`,
                    onClear: () => setTemporaryConditions([]),
                  },
                ]
              : []),
            ...(sort !== defaultOpportunityListSort
              ? [
                  {
                    key: "sort",
                    label: `排序：${opportunityListSortLabel(sort, listFieldDefinitionsQuery.data ?? [])}`,
                    onClear: () => setSort(defaultOpportunityListSort),
                  },
                ]
              : []),
          ]}
          search={{
            label: "搜索商机",
            placeholder: "搜索商机名称或关键词",
            value: request.keyword,
            onSearch: setKeyword,
          }}
          trailing={
            <Space wrap>
              <Space aria-label="商机场景" size="small" wrap>
                <Button
                  type={scene === "all" ? "primary" : "default"}
                  onClick={() => setScene("all")}
                >
                  全部商机
                </Button>
                <Button
                  disabled={!authorization?.actorId}
                  type={scene === "mine" ? "primary" : "default"}
                  onClick={() => setScene("mine")}
                >
                  我负责的
                </Button>
                <Button
                  type={scene === "starred" ? "primary" : "default"}
                  onClick={() => setScene("starred")}
                >
                  我关注的
                </Button>
                <Button
                  type={scene === "won" ? "primary" : "default"}
                  onClick={() => setScene("won")}
                >
                  赢单
                </Button>
                <Button
                  type={scene === "lost" ? "primary" : "default"}
                  onClick={() => setScene("lost")}
                >
                  输单
                </Button>
                <Button
                  type={scene === "invalid" ? "primary" : "default"}
                  onClick={() => setScene("invalid")}
                >
                  无效
                </Button>
              </Space>
              {customerRelation.controls}
              <Select<OpportunityListSort>
                aria-label="商机排序"
                options={opportunitySortOptions}
                value={sort}
                onChange={setSort}
              />
              <SavedViewControls
                entityLabel="商机"
                objectType="OPPORTUNITY"
                selection={savedViewSelection}
                onSelectionChange={setSavedView}
                temporaryConditions={temporaryConditions}
                onTemporaryConditionsChange={setTemporaryFilterConditions}
              />
              <ColumnPreferenceControls
                objectType="OPPORTUNITY"
                options={opportunityListColumnOptions}
                onVisibleCodesChange={updateVisibleOpportunityColumnCodes}
              />
              {hasAuthority(authorization, authority.opportunityPipelinesRead) ? (
                <ActionAuthority authority={authority.opportunityPipelinesManage}>
                  <Button onClick={() => navigate("/crm/opportunities/pipelines")}>
                    销售管线管理
                  </Button>
                </ActionAuthority>
              ) : null}
              <ActionAuthority authority={authority.opportunitiesWrite}>
                <Button type="primary" onClick={() => navigate("/crm/opportunities/new")}>
                  新建商机
                </Button>
              </ActionAuthority>
            </Space>
          }
          onClearAll={
            request.keyword ||
            scene !== "all" ||
            customerRelation.activeFilter !== undefined ||
            sort !== defaultOpportunityListSort ||
            temporaryConditions.length > 0
              ? clearFilters
              : undefined
          }
        />
        {opportunitySummaryQuery.data ? (
          <Card className={styles.summaryCard} size="small">
            <Space size="large" wrap>
              <Statistic
                suffix="项"
                title="符合当前条件的商机"
                value={opportunitySummaryQuery.data.count}
              />
              <Statistic
                suffix="元"
                title="预计成交总额"
                value={formatServerAmount(opportunitySummaryQuery.data.estimatedAmount)}
              />
            </Space>
          </Card>
        ) : null}
        <DataWorkspace
          errorMessage={
            customerRelation.error instanceof ApiError
              ? customerRelation.error.message
              : customerRelation.error !== undefined
                ? "所选客户暂时无法确认，请重新选择"
                : opportunitiesQuery.isError
                  ? opportunitiesQuery.error instanceof ApiError
                    ? opportunitiesQuery.error.message
                    : "商机列表暂时无法加载"
                  : undefined
          }
          label="商机数据工作区"
        >
          {batchActivitySuccessMessage ? (
            <Typography.Text role="status" type="success">
              {batchActivitySuccessMessage}
            </Typography.Text>
          ) : null}
          {batchActionSuccessMessage ? (
            <Typography.Text role="status" type="success">
              {batchActionSuccessMessage}
            </Typography.Text>
          ) : null}
          {starMutation.isError ? (
            <Alert
              title={
                starMutation.error instanceof ApiError
                  ? starMutation.error.message
                  : "商机关注状态暂时无法更新"
              }
              showIcon
              type="error"
            />
          ) : null}
          {batchDeleteMutation.isError ? (
            <Alert
              title={
                batchDeleteMutation.error instanceof ApiError
                  ? batchDeleteMutation.error.message
                  : "商机暂时无法批量删除"
              }
              showIcon
              type="error"
            />
          ) : null}
          <ResponsiveDataList
            bulkActions={
              <Space>
                {canBatchTransfer ? (
                  <Button
                    disabled={
                      batchOwnerMutation.isPending ||
                      selectedOpportunities.some(
                        (opportunity) => !hasOpportunityVersion(opportunity),
                      )
                    }
                    onClick={openBatchOwnerPicker}
                  >
                    转移
                  </Button>
                ) : null}
                {canDeleteOpportunities ? (
                  <Popconfirm
                    cancelText="取消"
                    description="服务端会先校验全部商机的版本和可见范围；任一项失败时不会删除其中任何商机。"
                    okButtonProps={{ danger: true, loading: batchDeleteMutation.isPending }}
                    okText="确认删除"
                    title={`确认删除选中的 ${selectedOpportunities.length} 条商机？`}
                    onConfirm={deleteSelectedOpportunities}
                  >
                    <Button
                      danger
                      disabled={
                        batchDeleteMutation.isPending ||
                        selectedOpportunities.some(
                          (opportunity) => !hasOpportunityVersion(opportunity),
                        )
                      }
                      loading={batchDeleteMutation.isPending}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                ) : null}
                {canComposeActivities ? (
                  <Button onClick={openBatchActivities}>批量写跟进</Button>
                ) : null}
              </Space>
            }
            columns={visibleColumns}
            loading={opportunitiesQuery.isLoading}
            page={page}
            rowKey={(opportunity) => opportunity.id}
            rowSelection={opportunityRowSelection}
            renderMobileItem={(opportunity) => (
              <Card
                className={styles.mobileCard}
                size="small"
                title={
                  <Space size="small">
                    <ListStarToggle
                      loading={starMutation.isPending}
                      starred={opportunity.starred}
                      onToggle={() => toggleOpportunityStar(opportunity)}
                    />
                    <Button
                      data-detail-trigger-id={opportunity.id}
                      type="link"
                      onClick={() => openOpportunity(opportunity)}
                    >
                      {opportunity.name}
                    </Button>
                  </Space>
                }
              >
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>
                    {opportunity.pipelineCode === null || opportunity.stageCode === null
                      ? "未提供销售阶段"
                      : `${opportunity.pipelineCode} / ${opportunity.stageCode}`}
                  </Typography.Text>
                  <Typography.Text>
                    {opportunity.customerId === null
                      ? "未提供关联客户"
                      : `客户 ${opportunity.customerId}`}
                  </Typography.Text>
                  <Typography.Text>
                    商机金额：{formatServerAmount(opportunity.estimatedAmount)}
                  </Typography.Text>
                  <Typography.Text>
                    预计成交：{opportunity.expectedCloseDate ?? "—"}
                  </Typography.Text>
                  <Typography.Text>
                    下次联系：{formatNextContactTime(opportunity.nextContactTime)}
                  </Typography.Text>
                  {canReadActivities ? (
                    <Typography.Text>
                      最后跟进：{formatNextContactTime(opportunity.lastActivityTime)}
                    </Typography.Text>
                  ) : null}
                  <div className={styles.mobileMeta}>
                    {opportunity.outcome ? <Tag>{opportunity.outcome}</Tag> : null}
                    {opportunity.status ? <Tag>{opportunity.status}</Tag> : null}
                  </div>
                </Space>
              </Card>
            )}
            selectedRowCount={selectedOpportunities.length}
            onPageChange={setPage}
          />
        </DataWorkspace>
        {customerRelation.modal}
        <Modal
          destroyOnHidden
          footer={null}
          open={batchOwnerPickerOpen}
          title="批量转移负责人"
          onCancel={closeBatchOwnerPicker}
        >
          <Typography.Paragraph type="secondary">
            {`将为 ${batchOwnerTargets.length} 条已选商机设置同一负责人。仅显示服务端允许当前成员查看的在职成员，最终可分配范围、字段权限和并发仍由服务端校验。`}
          </Typography.Paragraph>
          {batchOwnerMutation.isError ? (
            <Alert
              title={
                batchOwnerMutation.error instanceof ApiError
                  ? batchOwnerMutation.error.message
                  : "商机负责人暂时无法批量更新"
              }
              showIcon
              style={{ marginBottom: 12 }}
              type="error"
            />
          ) : null}
          <Input.Search
            allowClear
            value={batchOwnerKeyword}
            placeholder="按成员姓名搜索"
            onChange={(event) => setBatchOwnerKeyword(event.target.value)}
            onSearch={(keyword) => setBatchOwnerKeyword(keyword)}
          />
          {memberQuery.isError ? (
            <Alert title="成员列表暂时无法加载" showIcon style={{ marginTop: 12 }} type="error" />
          ) : (
            <List
              dataSource={[...(memberQuery.data ?? [])]}
              loading={memberQuery.isLoading}
              locale={{ emptyText: "未找到可选择成员" }}
              renderItem={(member) => (
                <List.Item
                  actions={[
                    <Button
                      disabled={batchOwnerMutation.isPending || batchOwnerTargets.length === 0}
                      key={member.actorId}
                      loading={batchOwnerMutation.isPending}
                      type="link"
                      onClick={() =>
                        batchOwnerMutation.mutate({
                          actorId: member.actorId,
                          opportunities: batchOwnerTargets,
                        })
                      }
                    >
                      转移
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
        </Modal>
        <BatchActivityModal
          objectLabel="商机"
          open={batchActivitiesOpen}
          subjectIds={selectedOpportunities.map((opportunity) => opportunity.id)}
          subjectType="OPPORTUNITY"
          onCancel={closeBatchActivities}
          onSuccess={completeBatchActivities}
        />
        <OpportunityDetailDrawer
          open={selectedOpportunityId !== null}
          opportunityId={selectedOpportunityId}
          onClose={closeOpportunityDrawer}
        />
      </main>
    </RouteAuthority>
  );
}
