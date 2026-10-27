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

import { saveControlledDownload } from "~/api/client/controlled-download";
import type { components } from "~/api/generated/schema";
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
import { customerRelationFilter } from "~/components/entity-selector/customer-relation-filter";
import { useGlobalRecordListRelationFilter } from "~/components/data-view/global-record-list-relation-filter";
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

import { toContactListItem, type ContactListItem } from "../model/contact-list-item";
import { selectedContactIdFromSearch } from "../model/contact-list-route";
import { ContactDetailDrawer } from "../components/contact-detail-drawer";
import { ContactListDuplicateCheckModal } from "../components/contact-list-duplicate-check-modal";
import {
  toContactListDuplicateCheckRequest,
  type ContactListDuplicateCheckValues,
} from "../model/contact-list-duplicate-check";
import {
  contactListSceneFromSearch,
  withContactListScene,
  type ContactListScene,
} from "../model/contact-list-scene";
import {
  contactCustomSortOptions,
  contactListSortFromSearch,
  contactListSortLabel,
  contactListSortOptions,
  defaultContactListSort,
  resolveContactListSort,
  withContactListSort,
  type ContactListSort,
} from "../model/contact-list-sort";
import { contactKeys } from "../model/query-keys";

import styles from "./contact-list-page.module.css";

type VersionedContactListItem = ContactListItem & { version: number };

function hasContactVersion(contact: ContactListItem): contact is VersionedContactListItem {
  return (
    typeof contact.version === "number" &&
    Number.isSafeInteger(contact.version) &&
    contact.version >= 0
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
  onOpen: (contact: ContactListItem) => void,
  onToggleStar: (contact: ContactListItem) => void,
  isStarUpdatePending: boolean,
  canReadActivities: boolean,
): ColumnsType<ContactListItem> {
  return [
    {
      dataIndex: "name",
      key: "contact_name",
      title: "联系人姓名",
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
      render: (_, contact) => (
        <Button data-detail-trigger-id={contact.id} type="link" onClick={() => onOpen(contact)}>
          查看
        </Button>
      ),
    },
  ];
}

const baseContactColumnOptions: readonly ColumnPreferenceOption[] = [
  { code: "contact_name", label: "联系人姓名" },
  { code: "job_title", label: "职务" },
  { code: "phone_number", label: "联系电话" },
  { code: "customer", label: "关联客户" },
  { code: "next_contact_time", label: "下次联系时间" },
  { code: "owner_actor", label: "负责人" },
  { code: "status", label: "状态" },
];

const activityContactColumnOptions: readonly ColumnPreferenceOption[] = [
  { code: "last_activity_time", label: "最后跟进时间" },
  { code: "last_activity_content", label: "最后跟进记录" },
];

const allContactColumnOptions: readonly ColumnPreferenceOption[] = [
  ...baseContactColumnOptions,
  ...activityContactColumnOptions,
];

const defaultContactExportFieldCodes = ["contact_name"] as const;

export function ContactListPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [duplicateCheckOpen, setDuplicateCheckOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<ContactListItem[]>([]);
  const [batchOwnerPickerOpen, setBatchOwnerPickerOpen] = useState(false);
  const [batchOwnerKeyword, setBatchOwnerKeyword] = useState("");
  const [batchOwnerTargets, setBatchOwnerTargets] = useState<readonly VersionedContactListItem[]>(
    [],
  );
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
  const [visibleContactColumnCodes, setVisibleContactColumnCodes] = useState<readonly string[]>(
    () => allContactColumnOptions.map((option) => option.code),
  );
  const search = searchParams.toString();
  const selectedContactId = useMemo(() => selectedContactIdFromSearch(search), [search]);
  const scene = contactListSceneFromSearch(search);
  const requestedSort = contactListSortFromSearch(search);
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
  const customerRelation = useGlobalRecordListRelationFilter({
    apiClient,
    canUse: hasAuthority(authorization, authority.customersRead),
    filter: customerRelationFilter,
    identityKey,
    searchParams,
    setSearchParams,
  });
  const canChangeContactTags = hasAuthority(authorization, authority.contactsWrite);
  const canAssignContacts = hasAuthority(authorization, authority.contactsAssign);
  const canDeleteContacts = hasAuthority(authorization, authority.contactsDelete);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canBatchTransfer = canAssignContacts && canReadOrganization;
  const canImportContacts =
    hasAuthority(authorization, authority.contactsWrite) &&
    hasAuthority(authorization, authority.filesWrite);
  const canReadActivities = hasAuthority(authorization, authority.activitiesRead);
  const canComposeActivities =
    canReadActivities && hasAuthority(authorization, authority.activitiesWrite);
  const canCheckContactDuplicates = hasAuthority(authorization, authority.contactsRead);
  const canReadSavedViews = hasAuthority(authorization, authority.savedViewsRead);
  const canReadListFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const contactColumnOptions = useMemo(
    () => (canReadActivities ? allContactColumnOptions : baseContactColumnOptions),
    [canReadActivities],
  );
  const listFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "CONTACT", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("CONTACT"),
    enabled: apiClient !== null && canReadListFieldMetadata,
  });
  const contactListColumnOptions = useMemo(
    () => [
      ...contactColumnOptions,
      ...dynamicListColumnOptions(
        listFieldDefinitionsQuery.data ?? [],
        contactColumnOptions.map((option) => option.code),
      ),
    ],
    [contactColumnOptions, listFieldDefinitionsQuery.data],
  );
  const sort = useMemo(
    () => resolveContactListSort(requestedSort, listFieldDefinitionsQuery.data ?? []),
    [listFieldDefinitionsQuery.data, requestedSort],
  );
  const contactSortOptions = useMemo(
    () => [
      ...contactListSortOptions,
      ...contactCustomSortOptions(listFieldDefinitionsQuery.data ?? []),
    ],
    [listFieldDefinitionsQuery.data],
  );
  const savedViewSelection = useMemo(() => savedViewSelectionFromSearch(search), [search]);
  const savedViewsQuery = useQuery({
    queryKey: savedViewKeys.list(identityKey, "CONTACT", true),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("保存视图暂时不可用。"))
        : apiClient.listSavedViews("CONTACT", true),
    enabled: apiClient !== null && canReadSavedViews,
  });
  const activeSavedView = resolveSavedView(savedViewsQuery.data ?? [], savedViewSelection);
  const contactRequest = useMemo(
    () =>
      withContactListSort(
        withContactListScene(
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
  const contactsQuery = useQuery({
    queryKey:
      temporaryConditions.length > 0
        ? contactKeys.temporaryFilteredList(identityKey, contactRequest)
        : contactKeys.listRequest(identityKey, contactRequest),
    queryFn: () =>
      apiClient?.getContacts(contactRequest) ??
      Promise.reject(new Error("Contacts API is unavailable.")),
    enabled: apiClient !== null && customerRelation.ready,
  });
  const memberQuery = useQuery({
    queryKey: ["member-selector", "contact-batch-owner", identityKey, batchOwnerKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Contact owner selection is unavailable."))
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
        ? Promise.reject(new Error("Contact CSV export is unavailable."))
        : apiClient.exportContactsCsv({
            fieldCodes: [...defaultContactExportFieldCodes],
            customerId: contactRequest.customerId,
            keyword: request.keyword,
            ownerActorId: contactRequest.ownerActorId,
            starred: contactRequest.starred,
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
    mutationFn: (values: ContactListDuplicateCheckValues) =>
      apiClient === null
        ? Promise.reject(new Error("Contact duplicate check is unavailable."))
        : apiClient.checkContactDuplicate(toContactListDuplicateCheckRequest(values)),
  });
  const batchTagMutation = useMutation({
    mutationFn: ({
      change,
      contacts,
    }: {
      change: BatchTagChange;
      contacts: VersionedContactListItem[];
    }) =>
      apiClient === null
        ? Promise.reject(new Error("联系人批量标签 API 暂时不可用。"))
        : apiClient.changeContactTags({
            contacts: contacts.map((contact) => ({
              contactId: contact.id,
              version: contact.version,
            })),
            addedTags: change.addedTags.length > 0 ? change.addedTags : undefined,
            removedTags: change.removedTags.length > 0 ? change.removedTags : undefined,
          }),
    onSuccess: (_, { contacts }) => {
      setSelectedContacts([]);
      setBatchTagsOpen(false);
      setBatchTagSuccessMessage(`已更新 ${contacts.length} 位联系人的标签。`);
      void queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
  const batchOwnerMutation = useMutation({
    mutationFn: ({
      actorId,
      contacts,
    }: {
      actorId: number;
      contacts: readonly VersionedContactListItem[];
    }) =>
      apiClient === null || contacts.length === 0
        ? Promise.reject(new Error("Contact owner batch update is unavailable."))
        : apiClient.updateContactOwners({
            ownerActorId: actorId,
            contacts: contacts.map((contact) => ({
              contactId: contact.id,
              version: contact.version,
            })),
          }),
    onSuccess: (_, { contacts }) => {
      setSelectedContacts([]);
      setBatchOwnerPickerOpen(false);
      setBatchOwnerKeyword("");
      setBatchOwnerTargets([]);
      setBatchActionSuccessMessage(`已转移 ${contacts.length} 位联系人。`);
      void queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
  const batchDeleteMutation = useMutation({
    mutationFn: (contacts: readonly VersionedContactListItem[]) =>
      apiClient === null || contacts.length === 0
        ? Promise.reject(new Error("Contact batch deletion is unavailable."))
        : apiClient.deleteContacts({
            contacts: contacts.map((contact) => ({
              contactId: contact.id,
              version: contact.version,
            })),
          }),
    onSuccess: (_, contacts) => {
      setSelectedContacts([]);
      setBatchActionSuccessMessage(`已删除 ${contacts.length} 位联系人。`);
      void queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
  const starMutation = useMutation({
    mutationFn: ({ contactId, starred }: { contactId: number; starred: boolean }) =>
      apiClient === null
        ? Promise.reject(new Error("联系人关注 API 暂时不可用。"))
        : apiClient.setContactStarred(contactId, { starred }),
    onSuccess: async (_, { contactId }) => {
      await queryClient.invalidateQueries({ queryKey: contactKeys.detail(identityKey, contactId) });
      await queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
    },
  });
  const page: PageResult<ContactListItem> = contactsQuery.data
    ? toPageResult(contactsQuery.data, toContactListItem)
    : { ...defaultPageRequest, items: [], total: null, meta: {} };
  const openContact = useCallback(
    (contact: ContactListItem) => {
      setSearchParams(updateSearch(searchParams, { contactId: contact.id }));
    },
    [searchParams, setSearchParams],
  );
  const closeContactDrawer = useCallback(() => {
    setSearchParams(updateSearch(searchParams, { contactId: undefined }));
  }, [searchParams, setSearchParams]);
  const toggleContactStar = useCallback(
    (contact: ContactListItem) =>
      starMutation.mutate({ contactId: contact.id, starred: !contact.starred }),
    [starMutation],
  );
  const visibleColumns = useMemo(() => {
    const source = [
      ...columns(openContact, toggleContactStar, starMutation.isPending, canReadActivities),
      ...dynamicListColumns<ContactListItem>(
        listFieldDefinitionsQuery.data ?? [],
        contactColumnOptions.map((option) => option.code),
      ),
    ];
    const byCode = new Map(source.map((column) => [String(column.key), column]));
    const visible = visibleContactColumnCodes.flatMap((code) => {
      const column = byCode.get(code);
      return column === undefined ? [] : [column];
    });
    const action = byCode.get("actions");
    return action === undefined ? visible : [...visible, action];
  }, [
    canReadActivities,
    contactColumnOptions,
    listFieldDefinitionsQuery.data,
    openContact,
    starMutation.isPending,
    toggleContactStar,
    visibleContactColumnCodes,
  ]);
  const updateVisibleContactColumnCodes = useCallback((codes: readonly string[]) => {
    setVisibleContactColumnCodes((current) =>
      current.length === codes.length && current.every((code, index) => code === codes[index])
        ? current
        : codes,
    );
  }, []);

  function setPage(nextPage: number, nextSize: number) {
    setSelectedContacts([]);
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function setKeyword(keyword: string) {
    setSelectedContacts([]);
    setSearchParams(updateSearch(searchParams, { keyword: keyword.trim() || undefined, page: 1 }));
  }

  function setScene(nextScene: ContactListScene) {
    setSelectedContacts([]);
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        scene: nextScene === "all" ? undefined : nextScene,
      }),
    );
  }

  function setSort(nextSort: ContactListSort) {
    setSelectedContacts([]);
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        sort: nextSort === defaultContactListSort ? undefined : nextSort,
      }),
    );
  }

  function setSavedView(selection: number | null) {
    setSelectedContacts([]);
    setTemporaryConditions([]);
    setSearchParams(
      updateSearch(searchParams, {
        page: 1,
        savedView: selection === null ? "all" : selection,
      }),
    );
  }

  function clearFilters() {
    setSelectedContacts([]);
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

  function setTemporaryFilterConditions(
    conditions: components["schemas"]["FilterConditionRequest"][],
  ) {
    setSelectedContacts([]);
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
    setSelectedContacts([]);
    setBatchActivitiesOpen(false);
    setBatchActivitySuccessMessage(`已为 ${createdCount} 位联系人批量记录跟进。`);
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
    const contacts = selectedContacts.filter(hasContactVersion);
    if (contacts.length !== selectedContacts.length) return;
    batchTagMutation.mutate({ change, contacts });
  }

  function openBatchOwnerPicker() {
    const contacts = selectedContacts.filter(hasContactVersion);
    if (contacts.length !== selectedContacts.length || contacts.length === 0) return;
    batchOwnerMutation.reset();
    setBatchOwnerTargets(contacts);
    setBatchOwnerPickerOpen(true);
  }

  function closeBatchOwnerPicker() {
    if (batchOwnerMutation.isPending) return;
    batchOwnerMutation.reset();
    setBatchOwnerPickerOpen(false);
    setBatchOwnerKeyword("");
    setBatchOwnerTargets([]);
  }

  function deleteSelectedContacts() {
    const contacts = selectedContacts.filter(hasContactVersion);
    if (contacts.length !== selectedContacts.length || contacts.length === 0) return;
    batchDeleteMutation.reset();
    batchDeleteMutation.mutate(contacts);
  }

  const contactRowSelection: TableProps<ContactListItem>["rowSelection"] =
    canChangeContactTags || canComposeActivities || canBatchTransfer || canDeleteContacts
      ? {
          selectedRowKeys: selectedContacts.map((contact) => contact.id),
          getCheckboxProps: (contact) => ({
            disabled: !canComposeActivities && !hasContactVersion(contact),
          }),
          onChange: (_, contacts) => setSelectedContacts(contacts),
        }
      : undefined;

  function openExport() {
    exportMutation.reset();
    setExportOpen(true);
  }

  function closeExport() {
    if (exportMutation.isPending) return;
    exportMutation.reset();
    setExportOpen(false);
  }

  function completeContactImport(importedRows: number) {
    setImportOpen(false);
    setImportSuccessMessage(`已导入 ${importedRows} 条联系人。`);
    void queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
  }

  return (
    <RouteAuthority authority={authority.contactsRead}>
      <main>
        <PageHeader title="联系人管理" />
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
              ? [{ key: "scene", label: "我负责的联系人", onClear: () => setScene("all") }]
              : []),
            ...(scene === "subordinates"
              ? [{ key: "scene", label: "下属负责的联系人", onClear: () => setScene("all") }]
              : []),
            ...(scene === "starred"
              ? [{ key: "scene", label: "我关注的联系人", onClear: () => setScene("all") }]
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
            ...(sort !== defaultContactListSort
              ? [
                  {
                    key: "sort",
                    label: `排序：${contactListSortLabel(sort, listFieldDefinitionsQuery.data ?? [])}`,
                    onClear: () => setSort(defaultContactListSort),
                  },
                ]
              : []),
          ]}
          search={{
            label: "搜索联系人",
            placeholder: "搜索联系人姓名或关键词",
            value: request.keyword,
            onSearch: setKeyword,
          }}
          trailing={
            <Space wrap>
              <Space aria-label="联系人场景" size="small" wrap>
                <Button
                  type={scene === "all" ? "primary" : "default"}
                  onClick={() => setScene("all")}
                >
                  全部联系人
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
                  type={scene === "starred" ? "primary" : "default"}
                  onClick={() => setScene("starred")}
                >
                  我关注的
                </Button>
              </Space>
              {customerRelation.controls}
              <Select<ContactListSort>
                aria-label="联系人排序"
                options={contactSortOptions}
                value={sort}
                onChange={setSort}
              />
              <SavedViewControls
                entityLabel="联系人"
                objectType="CONTACT"
                selection={savedViewSelection}
                onSelectionChange={setSavedView}
                temporaryConditions={temporaryConditions}
                onTemporaryConditionsChange={setTemporaryFilterConditions}
              />
              <ColumnPreferenceControls
                objectType="CONTACT"
                options={contactListColumnOptions}
                onVisibleCodesChange={updateVisibleContactColumnCodes}
              />
              {canCheckContactDuplicates ? (
                <Button onClick={openDuplicateCheck}>查重</Button>
              ) : null}
              <Button onClick={() => navigate("/crm/contacts/nearby")}>附近联系人</Button>
              <ActionAuthority authority={authority.contactsWrite}>
                <Button type="primary" onClick={() => navigate("/crm/contacts/new")}>
                  新建联系人
                </Button>
              </ActionAuthority>
              <ActionAuthority authority={authority.contactsExport}>
                <Button onClick={openExport}>导出 CSV</Button>
              </ActionAuthority>
              {canImportContacts ? (
                <Button onClick={() => setImportOpen(true)}>导入 CSV</Button>
              ) : null}
            </Space>
          }
          onClearAll={
            request.keyword ||
            scene !== "all" ||
            customerRelation.activeFilter !== undefined ||
            sort !== defaultContactListSort ||
            temporaryConditions.length > 0
              ? clearFilters
              : undefined
          }
        />
        <DataWorkspace
          errorMessage={
            customerRelation.error instanceof ApiError
              ? customerRelation.error.message
              : customerRelation.error !== undefined
                ? "所选客户暂时无法确认，请重新选择"
                : contactsQuery.isError
                  ? contactsQuery.error instanceof ApiError
                    ? contactsQuery.error.message
                    : "联系人列表暂时无法加载"
                  : undefined
          }
          label="联系人数据工作区"
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
                  : "联系人关注状态暂时无法更新"
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
                  : "联系人暂时无法批量删除"
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
                      selectedContacts.some((contact) => !hasContactVersion(contact))
                    }
                    onClick={openBatchOwnerPicker}
                  >
                    转移
                  </Button>
                ) : null}
                {canDeleteContacts ? (
                  <Popconfirm
                    cancelText="取消"
                    description="服务端会先校验全部联系人的版本、可见范围和层级依赖；任一项失败时不会删除其中任何联系人。"
                    okButtonProps={{ danger: true, loading: batchDeleteMutation.isPending }}
                    okText="确认删除"
                    title={`确认删除选中的 ${selectedContacts.length} 位联系人？`}
                    onConfirm={deleteSelectedContacts}
                  >
                    <Button
                      danger
                      disabled={
                        batchDeleteMutation.isPending ||
                        selectedContacts.some((contact) => !hasContactVersion(contact))
                      }
                      loading={batchDeleteMutation.isPending}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                ) : null}
                {canChangeContactTags ? (
                  <Button
                    disabled={selectedContacts.some((contact) => !hasContactVersion(contact))}
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
            loading={contactsQuery.isLoading}
            page={page}
            rowKey={(contact) => contact.id}
            rowSelection={contactRowSelection}
            renderMobileItem={(contact) => (
              <Card
                className={styles.mobileCard}
                size="small"
                title={
                  <Space size="small">
                    <ListStarToggle
                      loading={starMutation.isPending}
                      starred={contact.starred}
                      onToggle={() => toggleContactStar(contact)}
                    />
                    <Button
                      data-detail-trigger-id={contact.id}
                      type="link"
                      onClick={() => openContact(contact)}
                    >
                      {contact.name}
                    </Button>
                  </Space>
                }
              >
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{contact.jobTitle ?? "未提供职务"}</Typography.Text>
                  <Typography.Text>{contact.phoneNumber ?? "未提供联系电话"}</Typography.Text>
                  <Typography.Text>
                    下次联系：{formatNextContactTime(contact.nextContactTime)}
                  </Typography.Text>
                  {canReadActivities ? (
                    <>
                      <Typography.Text>
                        最后跟进：{formatNextContactTime(contact.lastActivityTime)}
                      </Typography.Text>
                      <Typography.Text>
                        最后跟进记录：{contact.lastActivityContent ?? "—"}
                      </Typography.Text>
                    </>
                  ) : null}
                  <div className={styles.mobileMeta}>
                    {contact.status ? <Tag>{contact.status}</Tag> : null}
                    {contact.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                </Space>
              </Card>
            )}
            selectedRowCount={selectedContacts.length}
            onPageChange={setPage}
          />
        </DataWorkspace>
        {customerRelation.modal}
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
          title="导出联系人 CSV"
          onCancel={closeExport}
        >
          <Typography.Paragraph type="secondary">
            {request.keyword
              ? `将导出当前关键词“${request.keyword}”匹配的服务端可见联系人。`
              : "将导出当前成员在服务端可见范围内的联系人。"}
            首期固定导出“联系人姓名”列，字段和数据范围均由服务端再次校验。
          </Typography.Paragraph>
          {exportMutation.isError ? (
            <Alert
              title={
                exportMutation.error instanceof ApiError
                  ? exportMutation.error.message
                  : "联系人导出暂时无法完成"
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
          objectType="CONTACT"
          open={importOpen}
          onCancel={() => setImportOpen(false)}
          onCompleted={completeContactImport}
        />
        <Modal
          destroyOnHidden
          footer={null}
          open={batchOwnerPickerOpen}
          title="批量转移负责人"
          onCancel={closeBatchOwnerPicker}
        >
          <Typography.Paragraph type="secondary">
            {`将为 ${batchOwnerTargets.length} 位已选联系人设置同一负责人。仅显示服务端允许当前成员查看的在职成员，最终可分配范围、字段权限和并发仍由服务端校验。`}
          </Typography.Paragraph>
          {batchOwnerMutation.isError ? (
            <Alert
              title={
                batchOwnerMutation.error instanceof ApiError
                  ? batchOwnerMutation.error.message
                  : "联系人负责人暂时无法批量更新"
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
                          contacts: batchOwnerTargets,
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
                : "联系人标签暂时无法更新，请稍后重试"
              : undefined
          }
          objectLabel="联系人"
          open={batchTagsOpen}
          pending={batchTagMutation.isPending}
          selectedCount={selectedContacts.length}
          onCancel={closeBatchTags}
          onSubmit={submitBatchTags}
        />
        <BatchActivityModal
          objectLabel="联系人"
          open={batchActivitiesOpen}
          subjectIds={selectedContacts.map((contact) => contact.id)}
          subjectType="CONTACT"
          onCancel={closeBatchActivities}
          onSuccess={completeBatchActivities}
        />
        <ContactListDuplicateCheckModal
          errorMessage={
            duplicateCheckMutation.isError
              ? duplicateCheckMutation.error instanceof ApiError
                ? duplicateCheckMutation.error.message
                : "联系人暂时无法查重"
              : undefined
          }
          open={duplicateCheckOpen}
          pending={duplicateCheckMutation.isPending}
          result={duplicateCheckMutation.data}
          onCancel={closeDuplicateCheck}
          onCheck={(values) => duplicateCheckMutation.mutate(values)}
        />
        <ContactDetailDrawer
          contactId={selectedContactId}
          open={selectedContactId !== null}
          onClose={closeContactDrawer}
        />
      </main>
    </RouteAuthority>
  );
}
