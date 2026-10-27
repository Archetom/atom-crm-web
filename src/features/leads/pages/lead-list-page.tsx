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
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { components } from "~/api/generated/schema";
import { saveControlledDownload } from "~/api/client/controlled-download";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
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
import { RouteAuthority } from "~/app/permissions/route-authority";
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
import { CrmCsvImportModal } from "~/features/crm-import-drafts";
import { SavedViewControls } from "~/features/saved-views";
import { savedViewKeys } from "~/features/saved-views";
import { resolveSavedView, savedViewSelectionFromSearch } from "~/features/saved-views";

import { toLeadListItem, type LeadListItem } from "../model/lead-list-item";
import { selectedLeadIdFromSearch } from "../model/lead-list-route";
import { LeadDetailDrawer } from "../components/lead-detail-drawer";
import { LeadListDuplicateCheckModal } from "../components/lead-list-duplicate-check-modal";
import {
  toLeadListDuplicateCheckRequest,
  type LeadListDuplicateCheckValues,
} from "../model/lead-list-duplicate-check";
import {
  leadListSceneFromSearch,
  withLeadListScene,
  type LeadListScene,
} from "../model/lead-list-scene";
import {
  defaultLeadListSort,
  leadCustomSortOptions,
  leadListSortFromSearch,
  leadListSortLabel,
  leadListSortOptions,
  resolveLeadListSort,
  withLeadListSort,
  type LeadListSort,
} from "../model/lead-list-sort";
import { leadKeys } from "../model/query-keys";

import styles from "./lead-list-page.module.css";

type VersionedLeadListItem = LeadListItem & { version: number };

function hasLeadVersion(lead: LeadListItem): lead is VersionedLeadListItem {
  return (
    typeof lead.version === "number" && Number.isSafeInteger(lead.version) && lead.version >= 0
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

function columns(
  onOpen: (lead: LeadListItem) => void,
  onToggleStar: (lead: LeadListItem) => void,
  isStarUpdatePending: boolean,
  canReadActivities: boolean,
): ColumnsType<LeadListItem> {
  return [
    {
      dataIndex: "name",
      key: "lead_name",
      title: "线索名称",
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
      dataIndex: "jobTitle",
      key: "job_title",
      title: "职务",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "phoneNumber",
      key: "phone_number",
      title: "联系电话",
      render: (value: string | null) => value ?? "—",
    },
    {
      dataIndex: "customerId",
      key: "customer",
      title: "关联客户",
      render: (value: number | null) => (value === null ? "—" : `客户 ${value}`),
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
          {
            dataIndex: "lastActivityContent",
            key: "last_activity_content",
            title: "最后跟进记录",
            render: (value: string | null) => value ?? "—",
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
      dataIndex: "status",
      key: "status",
      title: "状态",
      render: (value: string | null) => value ?? "—",
    },
    {
      fixed: "right",
      key: "actions",
      title: "操作",
      width: 88,
      render: (_, lead) => (
        <Button data-detail-trigger-id={lead.id} type="link" onClick={() => onOpen(lead)}>
          查看
        </Button>
      ),
    },
  ];
}

const baseLeadColumnOptions: readonly ColumnPreferenceOption[] = [
  { code: "lead_name", label: "线索名称" },
  { code: "job_title", label: "职务" },
  { code: "phone_number", label: "联系电话" },
  { code: "customer", label: "关联客户" },
  { code: "next_contact_time", label: "下次联系时间" },
  { code: "owner_actor", label: "负责人" },
  { code: "status", label: "状态" },
];

const activityLeadColumnOptions: readonly ColumnPreferenceOption[] = [
  { code: "last_activity_time", label: "最后跟进时间" },
  { code: "last_activity_content", label: "最后跟进记录" },
];

const allLeadColumnOptions: readonly ColumnPreferenceOption[] = [
  ...baseLeadColumnOptions,
  ...activityLeadColumnOptions,
];

const defaultLeadExportFieldCodes = ["lead_name"] as const;

export function LeadListPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [duplicateCheckOpen, setDuplicateCheckOpen] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<LeadListItem[]>([]);
  const [batchOwnerPickerOpen, setBatchOwnerPickerOpen] = useState(false);
  const [batchOwnerKeyword, setBatchOwnerKeyword] = useState("");
  const [batchOwnerTargets, setBatchOwnerTargets] = useState<readonly VersionedLeadListItem[]>([]);
  const [batchTagsOpen, setBatchTagsOpen] = useState(false);
  const [batchTagSuccessMessage, setBatchTagSuccessMessage] = useState<string | null>(null);
  const [batchActionSuccessMessage, setBatchActionSuccessMessage] = useState<string | null>(null);
  const [batchActivitiesOpen, setBatchActivitiesOpen] = useState(false);
  const [batchActivitySuccessMessage, setBatchActivitySuccessMessage] = useState<string | null>(
    null,
  );
  const [temporaryConditions, setTemporaryConditions] = useState<
    components["schemas"]["FilterConditionRequest"][]
  >([]);
  const [visibleLeadColumnCodes, setVisibleLeadColumnCodes] = useState<readonly string[]>(() =>
    allLeadColumnOptions.map((option) => option.code),
  );
  const search = searchParams.toString();
  const selectedLeadId = useMemo(() => selectedLeadIdFromSearch(search), [search]);
  const scene = leadListSceneFromSearch(search);
  const requestedSort = leadListSortFromSearch(search);
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
  const canChangeLeadTags = hasAuthority(authorization, authority.leadsWrite);
  const canAssignLeads = hasAuthority(authorization, authority.leadsAssign);
  const canDeleteLeads = hasAuthority(authorization, authority.leadsDelete);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canBatchTransfer = canAssignLeads && canReadOrganization;
  const canImportLeads =
    hasAuthority(authorization, authority.leadsWrite) &&
    hasAuthority(authorization, authority.filesWrite);
  const canReadActivities = hasAuthority(authorization, authority.activitiesRead);
  const canComposeActivities =
    canReadActivities && hasAuthority(authorization, authority.activitiesWrite);
  const canCheckLeadDuplicates = hasAuthority(authorization, authority.leadsRead);
  const canReadSavedViews = hasAuthority(authorization, authority.savedViewsRead);
  const canReadListFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const leadColumnOptions = useMemo(
    () => (canReadActivities ? allLeadColumnOptions : baseLeadColumnOptions),
    [canReadActivities],
  );
  const listFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "LEAD", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("LEAD"),
    enabled: apiClient !== null && canReadListFieldMetadata,
  });
  const leadListColumnOptions = useMemo(
    () => [
      ...leadColumnOptions,
      ...dynamicListColumnOptions(
        listFieldDefinitionsQuery.data ?? [],
        leadColumnOptions.map((option) => option.code),
      ),
    ],
    [leadColumnOptions, listFieldDefinitionsQuery.data],
  );
  const sort = useMemo(
    () => resolveLeadListSort(requestedSort, listFieldDefinitionsQuery.data ?? []),
    [listFieldDefinitionsQuery.data, requestedSort],
  );
  const leadSortOptions = useMemo(
    () => [...leadListSortOptions, ...leadCustomSortOptions(listFieldDefinitionsQuery.data ?? [])],
    [listFieldDefinitionsQuery.data],
  );
  const savedViewSelection = useMemo(() => savedViewSelectionFromSearch(search), [search]);
  const savedViewsQuery = useQuery({
    queryKey: savedViewKeys.list(identityKey, "LEAD", true),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("保存视图暂时不可用。"))
        : apiClient.listSavedViews("LEAD", true),
    enabled: apiClient !== null && canReadSavedViews,
  });
  const activeSavedView = resolveSavedView(savedViewsQuery.data ?? [], savedViewSelection);
  const leadRequest = useMemo(
    () =>
      withLeadListSort(
        withLeadListScene(
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
  const leadsQuery = useQuery({
    queryKey:
      temporaryConditions.length > 0
        ? leadKeys.temporaryFilteredList(identityKey, leadRequest)
        : leadKeys.listRequest(identityKey, leadRequest),
    queryFn: () =>
      apiClient?.getLeads(leadRequest) ?? Promise.reject(new Error("Leads API is unavailable.")),
    enabled: apiClient !== null,
  });
  const memberQuery = useQuery({
    queryKey: ["member-selector", "lead-batch-owner", identityKey, batchOwnerKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Lead owner selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: batchOwnerKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && batchOwnerPickerOpen && canReadOrganization,
  });
  const exportMutation = useMutation({
    mutationFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Lead CSV export is unavailable."))
        : apiClient.exportLeadsCsv({
            fieldCodes: [...defaultLeadExportFieldCodes],
            keyword: request.keyword,
            ownerActorId: leadRequest.ownerActorId,
            subordinateOwnerOnly: leadRequest.subordinateOwnerOnly,
            starred: leadRequest.starred,
            converted: leadRequest.converted,
            ...(temporaryConditions.length > 0
              ? { conditions: temporaryConditions }
              : { savedViewId: activeSavedView?.id }),
          }),
    onSuccess: (download) => {
      saveControlledDownload(download);
      setExportOpen(false);
    },
  });
  const batchTagMutation = useMutation({
    mutationFn: ({ change, leads }: { change: BatchTagChange; leads: VersionedLeadListItem[] }) =>
      apiClient === null
        ? Promise.reject(new Error("线索批量标签 API 暂时不可用。"))
        : apiClient.changeLeadTags({
            leads: leads.map((lead) => ({ leadId: lead.id, version: lead.version })),
            addedTags: change.addedTags.length > 0 ? change.addedTags : undefined,
            removedTags: change.removedTags.length > 0 ? change.removedTags : undefined,
          }),
    onSuccess: (_, { leads }) => {
      setSelectedLeads([]);
      setBatchTagsOpen(false);
      setBatchTagSuccessMessage(`已更新 ${leads.length} 条线索的标签。`);
      void queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
  const batchOwnerMutation = useMutation({
    mutationFn: ({
      actorId,
      leads,
    }: {
      actorId: number;
      leads: readonly VersionedLeadListItem[];
    }) =>
      apiClient === null || leads.length === 0
        ? Promise.reject(new Error("Lead owner batch update is unavailable."))
        : apiClient.updateLeadOwners({
            ownerActorId: actorId,
            leads: leads.map((lead) => ({ leadId: lead.id, version: lead.version })),
          }),
    onSuccess: (_, { leads }) => {
      setSelectedLeads([]);
      setBatchOwnerPickerOpen(false);
      setBatchOwnerKeyword("");
      setBatchOwnerTargets([]);
      setBatchActionSuccessMessage(`已转移 ${leads.length} 条线索。`);
      void queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
  const batchDeleteMutation = useMutation({
    mutationFn: (leads: readonly VersionedLeadListItem[]) =>
      apiClient === null || leads.length === 0
        ? Promise.reject(new Error("Lead batch deletion is unavailable."))
        : apiClient.deleteLeads({
            leads: leads.map((lead) => ({ leadId: lead.id, version: lead.version })),
          }),
    onSuccess: (_, leads) => {
      setSelectedLeads([]);
      setBatchActionSuccessMessage(`已删除 ${leads.length} 条线索。`);
      void queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
  const starMutation = useMutation({
    mutationFn: ({ leadId, starred }: { leadId: number; starred: boolean }) =>
      apiClient === null
        ? Promise.reject(new Error("线索关注 API 暂时不可用。"))
        : apiClient.setLeadStarred(leadId, { starred }),
    onSuccess: async (_, { leadId }) => {
      await queryClient.invalidateQueries({ queryKey: leadKeys.detail(identityKey, leadId) });
      await queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
    },
  });
  const duplicateCheckMutation = useMutation({
    mutationFn: (values: LeadListDuplicateCheckValues) =>
      apiClient === null
        ? Promise.reject(new Error("Lead duplicate check is unavailable."))
        : apiClient.checkLeadDuplicate(toLeadListDuplicateCheckRequest(values)),
  });
  const page: PageResult<LeadListItem> = leadsQuery.data
    ? toPageResult(leadsQuery.data, toLeadListItem)
    : { ...defaultPageRequest, items: [], total: null, meta: {} };
  const openLead = useCallback(
    (lead: LeadListItem) => {
      setSearchParams(updateSearch(searchParams, { leadId: lead.id }));
    },
    [searchParams, setSearchParams],
  );
  const closeLeadDrawer = useCallback(() => {
    setSearchParams(updateSearch(searchParams, { leadId: undefined }));
  }, [searchParams, setSearchParams]);
  const toggleLeadStar = useCallback(
    (lead: LeadListItem) => starMutation.mutate({ leadId: lead.id, starred: !lead.starred }),
    [starMutation],
  );
  const visibleColumns = useMemo(() => {
    const source = [
      ...columns(openLead, toggleLeadStar, starMutation.isPending, canReadActivities),
      ...dynamicListColumns<LeadListItem>(
        listFieldDefinitionsQuery.data ?? [],
        leadColumnOptions.map((option) => option.code),
      ),
    ];
    const byCode = new Map(source.map((column) => [String(column.key), column]));
    const visible = visibleLeadColumnCodes.flatMap((code) => {
      const column = byCode.get(code);
      return column === undefined ? [] : [column];
    });
    const action = byCode.get("actions");
    return action === undefined ? visible : [...visible, action];
  }, [
    canReadActivities,
    leadColumnOptions,
    listFieldDefinitionsQuery.data,
    openLead,
    starMutation.isPending,
    toggleLeadStar,
    visibleLeadColumnCodes,
  ]);
  const updateVisibleLeadColumnCodes = useCallback((codes: readonly string[]) => {
    setVisibleLeadColumnCodes((current) =>
      current.length === codes.length && current.every((code, index) => code === codes[index])
        ? current
        : codes,
    );
  }, []);

  function setPage(nextPage: number, nextSize: number) {
    setSelectedLeads([]);
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function setKeyword(keyword: string) {
    setSelectedLeads([]);
    setSearchParams(updateSearch(searchParams, { keyword: keyword.trim() || undefined, page: 1 }));
  }

  function setScene(nextScene: LeadListScene) {
    setSelectedLeads([]);
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        scene: nextScene === "unconverted" ? undefined : nextScene,
      }),
    );
  }

  function setSort(nextSort: LeadListSort) {
    setSelectedLeads([]);
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        sort: nextSort === defaultLeadListSort ? undefined : nextSort,
      }),
    );
  }

  function setSavedView(selection: number | null) {
    setSelectedLeads([]);
    setTemporaryConditions([]);
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        savedView: selection === null ? "all" : selection,
      }),
    );
  }

  function clearFilters() {
    setSelectedLeads([]);
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
    setSelectedLeads([]);
    setTemporaryConditions(conditions);
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
    setSelectedLeads([]);
    setBatchActivitiesOpen(false);
    setBatchActivitySuccessMessage(`已为 ${createdCount} 条线索批量记录跟进。`);
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

  function completeLeadImport(importedRows: number) {
    setImportOpen(false);
    setImportSuccessMessage(`已导入 ${importedRows} 条线索。`);
    void queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
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

  function closeBatchTags() {
    if (batchTagMutation.isPending) return;
    batchTagMutation.reset();
    setBatchTagsOpen(false);
  }

  function submitBatchTags(change: BatchTagChange) {
    const leads = selectedLeads.filter(hasLeadVersion);
    if (leads.length !== selectedLeads.length) return;
    batchTagMutation.mutate({ change, leads });
  }

  function openBatchOwnerPicker() {
    const leads = selectedLeads.filter(hasLeadVersion);
    if (leads.length !== selectedLeads.length || leads.length === 0) return;
    batchOwnerMutation.reset();
    setBatchOwnerTargets(leads);
    setBatchOwnerPickerOpen(true);
  }

  function closeBatchOwnerPicker() {
    if (batchOwnerMutation.isPending) return;
    batchOwnerMutation.reset();
    setBatchOwnerPickerOpen(false);
    setBatchOwnerKeyword("");
    setBatchOwnerTargets([]);
  }

  function deleteSelectedLeads() {
    const leads = selectedLeads.filter(hasLeadVersion);
    if (leads.length !== selectedLeads.length || leads.length === 0) return;
    batchDeleteMutation.reset();
    batchDeleteMutation.mutate(leads);
  }

  const leadRowSelection: TableProps<LeadListItem>["rowSelection"] =
    canChangeLeadTags || canComposeActivities || canBatchTransfer || canDeleteLeads
      ? {
          selectedRowKeys: selectedLeads.map((lead) => lead.id),
          getCheckboxProps: (lead) => ({
            disabled: !canComposeActivities && !hasLeadVersion(lead),
          }),
          onChange: (_, leads) => setSelectedLeads(leads),
        }
      : undefined;

  return (
    <RouteAuthority authority={authority.leadsRead}>
      <main>
        <PageHeader title="线索管理" />
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
            ...(scene === "unconverted"
              ? []
              : scene === "mine"
                ? [{ key: "scene", label: "我负责的线索", onClear: () => setScene("unconverted") }]
                : scene === "subordinates"
                  ? [
                      {
                        key: "scene",
                        label: "下属负责的线索",
                        onClear: () => setScene("unconverted"),
                      },
                    ]
                  : scene === "converted"
                    ? [
                        {
                          key: "scene",
                          label: "已转化线索",
                          onClear: () => setScene("unconverted"),
                        },
                      ]
                    : []),
            ...(scene === "starred"
              ? [{ key: "scene", label: "我关注的线索", onClear: () => setScene("unconverted") }]
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
            ...(sort !== defaultLeadListSort
              ? [
                  {
                    key: "sort",
                    label: `排序：${leadListSortLabel(sort, listFieldDefinitionsQuery.data ?? [])}`,
                    onClear: () => setSort(defaultLeadListSort),
                  },
                ]
              : []),
          ]}
          search={{
            label: "搜索线索",
            placeholder: "搜索线索名称或关键词",
            value: request.keyword,
            onSearch: setKeyword,
          }}
          trailing={
            <Space wrap>
              <Space aria-label="线索场景" size="small" wrap>
                <Button
                  type={scene === "unconverted" ? "primary" : "default"}
                  onClick={() => setScene("unconverted")}
                >
                  未转化
                </Button>
                <Button
                  disabled={!authorization?.actorId}
                  type={scene === "mine" ? "primary" : "default"}
                  onClick={() => setScene("mine")}
                >
                  我负责的
                </Button>
                <Button
                  type={scene === "subordinates" ? "primary" : "default"}
                  onClick={() => setScene("subordinates")}
                >
                  下属负责的
                </Button>
                <Button
                  type={scene === "converted" ? "primary" : "default"}
                  onClick={() => setScene("converted")}
                >
                  已转化
                </Button>
                <Button
                  type={scene === "starred" ? "primary" : "default"}
                  onClick={() => setScene("starred")}
                >
                  我关注的
                </Button>
              </Space>
              <Select<LeadListSort>
                aria-label="线索排序"
                options={leadSortOptions}
                value={sort}
                onChange={setSort}
              />
              <SavedViewControls
                entityLabel="线索"
                objectType="LEAD"
                selection={savedViewSelection}
                onSelectionChange={setSavedView}
                temporaryConditions={temporaryConditions}
                onTemporaryConditionsChange={setTemporaryFilterConditions}
              />
              <ColumnPreferenceControls
                objectType="LEAD"
                options={leadListColumnOptions}
                onVisibleCodesChange={updateVisibleLeadColumnCodes}
              />
              {canCheckLeadDuplicates ? <Button onClick={openDuplicateCheck}>查重</Button> : null}
              <ActionAuthority authority={authority.leadsExport}>
                <Button onClick={openExport}>导出 CSV</Button>
              </ActionAuthority>
              {canImportLeads ? (
                <Button onClick={() => setImportOpen(true)}>导入 CSV</Button>
              ) : null}
              <Button onClick={() => navigate("/crm/leads/nearby")}>附近线索</Button>
              <ActionAuthority authority={authority.leadsIntakeManage}>
                <Button onClick={() => navigate("/crm/leads/intake-clients")}>接入客户端</Button>
              </ActionAuthority>
              <ActionAuthority authority={authority.leadsWrite}>
                <Button type="primary" onClick={() => navigate("/crm/leads/new")}>
                  新建线索
                </Button>
              </ActionAuthority>
            </Space>
          }
          onClearAll={
            request.keyword ||
            scene !== "unconverted" ||
            sort !== defaultLeadListSort ||
            temporaryConditions.length > 0
              ? clearFilters
              : undefined
          }
        />
        <DataWorkspace
          errorMessage={
            leadsQuery.isError
              ? leadsQuery.error instanceof ApiError
                ? leadsQuery.error.message
                : "线索列表暂时无法加载"
              : undefined
          }
          label="线索数据工作区"
        >
          {batchTagSuccessMessage ? (
            <Typography.Text role="status" type="success">
              {batchTagSuccessMessage}
            </Typography.Text>
          ) : null}
          {batchActionSuccessMessage ? (
            <Typography.Text role="status" type="success">
              {batchActionSuccessMessage}
            </Typography.Text>
          ) : null}
          {importSuccessMessage ? (
            <Typography.Text role="status" type="success">
              {importSuccessMessage}
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
                  : "线索关注状态暂时无法更新"
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
                  : "线索暂时无法批量删除"
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
                      selectedLeads.some((lead) => !hasLeadVersion(lead))
                    }
                    onClick={openBatchOwnerPicker}
                  >
                    转移
                  </Button>
                ) : null}
                {canDeleteLeads ? (
                  <Popconfirm
                    cancelText="取消"
                    description="服务端会先校验全部线索的版本、可见范围和层级依赖；任一项失败时不会删除其中任何线索。"
                    okButtonProps={{ danger: true, loading: batchDeleteMutation.isPending }}
                    okText="确认删除"
                    title={`确认删除选中的 ${selectedLeads.length} 条线索？`}
                    onConfirm={deleteSelectedLeads}
                  >
                    <Button
                      danger
                      disabled={
                        batchDeleteMutation.isPending ||
                        selectedLeads.some((lead) => !hasLeadVersion(lead))
                      }
                      loading={batchDeleteMutation.isPending}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                ) : null}
                {canChangeLeadTags ? (
                  <Button
                    disabled={selectedLeads.some((lead) => !hasLeadVersion(lead))}
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
            columns={visibleColumns}
            loading={leadsQuery.isLoading}
            page={page}
            rowKey={(lead) => lead.id}
            rowSelection={leadRowSelection}
            renderMobileItem={(lead) => (
              <Card
                className={styles.mobileCard}
                size="small"
                title={
                  <Space size="small">
                    <ListStarToggle
                      loading={starMutation.isPending}
                      starred={lead.starred}
                      onToggle={() => toggleLeadStar(lead)}
                    />
                    <Button
                      data-detail-trigger-id={lead.id}
                      type="link"
                      onClick={() => openLead(lead)}
                    >
                      {lead.name}
                    </Button>
                  </Space>
                }
              >
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{lead.jobTitle ?? "未提供职务"}</Typography.Text>
                  <Typography.Text>{lead.phoneNumber ?? "未提供联系电话"}</Typography.Text>
                  <Typography.Text>
                    下次联系：{formatNextContactTime(lead.nextContactTime)}
                  </Typography.Text>
                  {canReadActivities ? (
                    <>
                      <Typography.Text>
                        最后跟进：{formatNextContactTime(lead.lastActivityTime)}
                      </Typography.Text>
                      <Typography.Text>
                        最后跟进记录：{lead.lastActivityContent ?? "—"}
                      </Typography.Text>
                    </>
                  ) : null}
                  <div className={styles.mobileMeta}>
                    {lead.status ? <Tag>{lead.status}</Tag> : null}
                    {lead.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                </Space>
              </Card>
            )}
            selectedRowCount={selectedLeads.length}
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
          title="导出线索 CSV"
          onCancel={closeExport}
        >
          <Typography.Paragraph type="secondary">
            {request.keyword
              ? `将导出当前关键词“${request.keyword}”及已选场景、筛选条件下服务端可见的线索。`
              : "将导出当前场景、筛选条件下服务端可见的线索。"}
            首期固定导出“线索名称”列，字段和数据范围均由服务端再次校验。
          </Typography.Paragraph>
          {exportMutation.isError ? (
            <Alert
              title={
                exportMutation.error instanceof ApiError
                  ? exportMutation.error.message
                  : "线索导出暂时无法完成"
              }
              showIcon
              style={{ marginTop: 16 }}
              type="error"
            />
          ) : null}
        </Modal>
        <CrmCsvImportModal
          apiClient={apiClient}
          identityKey={identityKey}
          objectType="LEAD"
          open={importOpen}
          onCancel={() => setImportOpen(false)}
          onCompleted={completeLeadImport}
        />
        <Modal
          destroyOnHidden
          footer={null}
          open={batchOwnerPickerOpen}
          title="批量转移负责人"
          onCancel={closeBatchOwnerPicker}
        >
          <Typography.Paragraph type="secondary">
            {`将为 ${batchOwnerTargets.length} 条已选线索设置同一负责人。仅显示服务端允许当前成员查看的在职成员，最终可分配范围、字段权限和并发仍由服务端校验。`}
          </Typography.Paragraph>
          {batchOwnerMutation.isError ? (
            <Alert
              title={
                batchOwnerMutation.error instanceof ApiError
                  ? batchOwnerMutation.error.message
                  : "线索负责人暂时无法批量更新"
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
                          leads: batchOwnerTargets,
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
        <BatchTagModal
          errorMessage={
            batchTagMutation.isError
              ? batchTagMutation.error instanceof ApiError
                ? batchTagMutation.error.message
                : "线索标签暂时无法更新，请稍后重试"
              : undefined
          }
          objectLabel="线索"
          open={batchTagsOpen}
          pending={batchTagMutation.isPending}
          selectedCount={selectedLeads.length}
          onCancel={closeBatchTags}
          onSubmit={submitBatchTags}
        />
        <BatchActivityModal
          objectLabel="线索"
          open={batchActivitiesOpen}
          subjectIds={selectedLeads.map((lead) => lead.id)}
          subjectType="LEAD"
          onCancel={closeBatchActivities}
          onSuccess={completeBatchActivities}
        />
        <LeadListDuplicateCheckModal
          errorMessage={
            duplicateCheckMutation.isError
              ? duplicateCheckMutation.error instanceof ApiError
                ? duplicateCheckMutation.error.message
                : "线索暂时无法查重"
              : undefined
          }
          open={duplicateCheckOpen}
          pending={duplicateCheckMutation.isPending}
          result={duplicateCheckMutation.data}
          onCancel={closeDuplicateCheck}
          onCheck={(values) => duplicateCheckMutation.mutate(values)}
        />
        <LeadDetailDrawer
          leadId={selectedLeadId}
          open={selectedLeadId !== null}
          onClose={closeLeadDrawer}
        />
      </main>
    </RouteAuthority>
  );
}
