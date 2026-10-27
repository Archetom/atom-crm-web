import { ArrowLeftOutlined, LockOutlined, StarFilled, StarOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { getMutationConflict } from "~/api/errors/mutation-conflict";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { ControlledFileFieldDownloadCard } from "~/components/controlled-file-field";
import { toPageResult } from "~/components/data-view/pagination";
import {
  CustomFieldFormFields,
  createFieldMetadataQueryKeys,
  customFieldFormDefinitions,
  serverProvidedDynamicFields,
  ServerProvidedDynamicFieldDescriptions,
  validateCustomFieldFormValues,
  type CustomFieldValues,
} from "~/components/dynamic-field";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";
import {
  MutationConflictNotice,
  type MutationConflictResolution,
} from "~/components/feedback/mutation-conflict-notice";
import { ActivityTimelineCard } from "~/features/activities";
import { ApprovalStartAction } from "~/features/approvals";
import { toCustomerListItem } from "~/features/customers";

import { leadKeys } from "../model/query-keys";
import { type LeadCollaborator, type LeadCollaboratorAccess } from "../model/lead-collaborator";
import { type LeadConversion } from "../model/lead-conversion";
import { type LeadAddress } from "../model/lead-detail";
import { toLeadCustomFieldUpdateRequest } from "../model/lead-form";
import { visibleDescendantIds } from "../model/lead-hierarchy";
import { toLeadListItem } from "../model/lead-list-item";
import { normalizeLeadTagDraft } from "../model/lead-tag";

import styles from "./lead-detail-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

function displayValue(value: number | string | null): string {
  return value === null ? "—" : String(value);
}

function displayAddresses(addresses: readonly LeadAddress[] | undefined): string {
  if (addresses === undefined || addresses.length === 0) return "—";
  const text = addresses
    .map((address) =>
      [
        address.label,
        address.country,
        address.region,
        address.city,
        address.addressLine,
        address.postalCode,
      ]
        .filter((value): value is string => value !== null && value.length > 0)
        .join(" "),
    )
    .filter((address) => address.length > 0)
    .join("；");
  return text.length > 0 ? text : "—";
}

type LeadDealStatus = "OPEN" | "WON";

function isLeadDealStatus(value: string | null): value is LeadDealStatus {
  return value === "OPEN" || value === "WON";
}

export function LeadDetailPage() {
  const { leadId: leadIdParam } = useParams();
  return <LeadDetailSurface leadId={parseRouteId(leadIdParam)} />;
}

export function LeadDetailSurface({
  leadId,
  onClose,
}: Readonly<{
  leadId: number | null;
  onClose?: () => void;
}>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  function closeDetail() {
    if (onClose !== undefined) {
      onClose();
      return;
    }
    navigate("/crm/leads", { replace: true });
  }
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [conversionOpen, setConversionOpen] = useState(false);
  const [conversionCustomerName, setConversionCustomerName] = useState("");
  const [conversionContactName, setConversionContactName] = useState("");
  const [conversionContactJobTitle, setConversionContactJobTitle] = useState("");
  const [conversionResult, setConversionResult] = useState<LeadConversion | null>(null);
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [ownerMemberKeyword, setOwnerMemberKeyword] = useState("");
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [parentKeyword, setParentKeyword] = useState("");
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [stateDraft, setStateDraft] = useState<{
    locked: boolean;
    dealStatus: LeadDealStatus;
  } | null>(null);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState<readonly string[] | null>(null);
  const [customFieldEditorOpen, setCustomFieldEditorOpen] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const [changedCustomFieldCodes, setChangedCustomFieldCodes] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [customFieldErrors, setCustomFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [customFieldMemberKeyword, setCustomFieldMemberKeyword] = useState("");
  const [collaboratorPickerOpen, setCollaboratorPickerOpen] = useState(false);
  const [collaboratorMemberKeyword, setCollaboratorMemberKeyword] = useState("");
  const [collaboratorDraft, setCollaboratorDraft] = useState<readonly LeadCollaborator[] | null>(
    null,
  );
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const canReadContacts = hasAuthority(authorization, authority.contactsRead);
  const canReadFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadFileFields =
    hasAuthority(authorization, authority.leadsRead) &&
    hasAuthority(authorization, authority.filesRead);
  const canManageCollaborators = hasAuthority(authorization, authority.leadsAssign);
  const canWriteLeads = hasAuthority(authorization, authority.leadsWrite);
  const leadQuery = useQuery({
    queryKey:
      leadId === null ? leadKeys.detail(identityKey, 0) : leadKeys.detail(identityKey, leadId),
    queryFn: () =>
      leadId === null || apiClient === null
        ? Promise.reject(new Error("Lead detail is unavailable."))
        : apiClient.getLead(leadId),
    enabled: apiClient !== null && leadId !== null,
  });
  const fieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "LEAD", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Lead field definitions are unavailable."))
        : apiClient.getFieldDefinitions("LEAD"),
    enabled: apiClient !== null && leadId !== null && canReadFieldMetadata,
  });
  const customFieldDefinitions = fieldDefinitionsQuery.data ?? [];
  const customFormFieldDefinitions = customFieldFormDefinitions(customFieldDefinitions);
  const hasMemberCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "USER",
  );
  const hasDepartmentCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "DEPARTMENT",
  );
  const customFieldMemberQuery = useQuery({
    queryKey: [
      "lead-detail-custom-field-member-selector",
      identityKey,
      customFieldMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("线索自定义人员字段的成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled:
      apiClient !== null && customFieldEditorOpen && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["lead-detail-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("线索自定义部门字段的部门目录暂时不可用。"))
        : apiClient.getVisibleDepartments(),
    enabled:
      apiClient !== null &&
      customFieldEditorOpen &&
      canReadOrganization &&
      hasDepartmentCustomField,
  });
  const hierarchyQuery = useQuery({
    queryKey:
      leadId === null
        ? leadKeys.hierarchy(identityKey, 0)
        : leadKeys.hierarchy(identityKey, leadId),
    queryFn: () =>
      leadId === null || apiClient === null
        ? Promise.reject(new Error("Lead hierarchy is unavailable."))
        : apiClient.getLeadHierarchy(leadId),
    enabled: apiClient !== null && leadId !== null,
  });
  const tagCatalogQuery = useQuery({
    queryKey: ["lead-tag-catalog", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Lead tag catalog is unavailable."))
        : apiClient.getLeadTagCatalog(),
    enabled: apiClient !== null && tagEditorOpen && canWriteLeads,
  });
  const starMutation = useMutation({
    mutationFn: (starred: boolean) =>
      apiClient === null || leadId === null
        ? Promise.reject(new Error("Lead star is unavailable."))
        : apiClient.setLeadStarred(leadId, { starred }),
    onSuccess: async (_, starred) => {
      if (leadId === null) return;
      await queryClient.cancelQueries({ queryKey: leadKeys.detail(identityKey, leadId) });
      queryClient.setQueryData(
        leadKeys.detail(identityKey, leadId),
        (current: typeof leadQuery.data) =>
          current === undefined ? current : { ...current, starred },
      );
      queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
    },
  });
  const customerCandidateQuery = useQuery({
    queryKey: ["lead-customer-selector", identityKey, customerKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer selection is unavailable."))
        : apiClient.getCustomers({
            page: 1,
            size: 50,
            keyword: customerKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && customerPickerOpen && canReadCustomers,
  });
  const customerMutation = useMutation({
    mutationFn: ({ customerId, version }: { customerId: number | null; version: number }) =>
      apiClient === null || leadId === null
        ? Promise.reject(new Error("Lead customer update is unavailable."))
        : apiClient.updateLead(leadId, { customerId, version }),
    onSuccess: (updatedLead) => {
      queryClient.setQueryData(leadKeys.detail(identityKey, updatedLead.id), updatedLead);
      queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
      setCustomerPickerOpen(false);
      setCustomerKeyword("");
    },
  });
  const ownerMemberQuery = useQuery({
    queryKey: ["member-selector", "lead-owner", identityKey, ownerMemberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Member selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: ownerMemberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && ownerPickerOpen && canReadOrganization,
  });
  const ownerMutation = useMutation({
    mutationFn: ({ actorId, version }: { actorId: number; version: number }) =>
      apiClient === null || leadId === null
        ? Promise.reject(new Error("Lead owner update is unavailable."))
        : apiClient.updateLeadOwner(leadId, { ownerActorId: actorId, version }),
    onSuccess: (updatedLead) => {
      queryClient.setQueryData(leadKeys.detail(identityKey, updatedLead.id), updatedLead);
      queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
      setOwnerPickerOpen(false);
      setOwnerMemberKeyword("");
    },
  });
  const parentCandidateQuery = useQuery({
    queryKey: ["lead-parent-selector", identityKey, parentKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Lead parent selection is unavailable."))
        : apiClient.getLeads({
            page: 1,
            size: 50,
            keyword: parentKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && parentPickerOpen,
  });
  const parentMutation = useMutation({
    mutationFn: ({ parentLeadId, version }: { parentLeadId?: number; version: number }) =>
      apiClient === null || leadId === null
        ? Promise.reject(new Error("Lead parent update is unavailable."))
        : apiClient.updateLeadParent(leadId, { parentLeadId, version }),
    onSuccess: (updatedLead) => {
      queryClient.setQueryData(leadKeys.detail(identityKey, updatedLead.id), updatedLead);
      queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
      queryClient.invalidateQueries({ queryKey: leadKeys.hierarchy(identityKey, updatedLead.id) });
      setParentPickerOpen(false);
      setParentKeyword("");
    },
  });
  const stateMutation = useMutation({
    mutationFn: ({
      locked,
      dealStatus,
      version,
    }: {
      locked: boolean;
      dealStatus: LeadDealStatus;
      version: number;
    }) =>
      apiClient === null || leadId === null
        ? Promise.reject(new Error("Lead state update is unavailable."))
        : apiClient.updateLeadState(leadId, { locked, dealStatus, version }),
    onSuccess: (updatedLead) => {
      queryClient.setQueryData(leadKeys.detail(identityKey, updatedLead.id), updatedLead);
      queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
      setStatePickerOpen(false);
      setStateDraft(null);
    },
  });
  const tagMutation = useMutation({
    mutationFn: ({ tags, version }: { tags: readonly string[]; version: number }) =>
      apiClient === null || leadId === null
        ? Promise.reject(new Error("Lead tag update is unavailable."))
        : apiClient.replaceLeadTags(leadId, { tags: [...tags], version }),
    onSuccess: (updatedLead) => {
      queryClient.setQueryData(leadKeys.detail(identityKey, updatedLead.id), updatedLead);
      queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
      queryClient.invalidateQueries({ queryKey: ["lead-tag-catalog", identityKey] });
      setTagEditorOpen(false);
      setTagDraft(null);
    },
  });
  const customFieldUpdateMutation = useMutation({
    mutationFn: ({
      changedCodes,
      values,
      version,
    }: {
      changedCodes: ReadonlySet<string>;
      values: CustomFieldValues;
      version: number;
    }) =>
      apiClient === null || leadId === null
        ? Promise.reject(new Error("Lead custom-field update is unavailable."))
        : apiClient
            .updateLead(
              leadId,
              toLeadCustomFieldUpdateRequest(customFieldDefinitions, {
                changedCodes,
                customFields: values,
                version,
              }),
            )
            .then((updatedLead) => {
              if (updatedLead.id !== leadId) {
                throw new Error("更新线索响应暂时不可用，请稍后重试。");
              }
              return updatedLead;
            }),
    onSuccess: (updatedLead) => {
      queryClient.setQueryData(leadKeys.detail(identityKey, updatedLead.id), updatedLead);
      void queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
      setChangedCustomFieldCodes(new Set());
      setCustomFieldErrors({});
      setCustomFieldValues({});
      setCustomFieldMemberKeyword("");
      setCustomFieldEditorOpen(false);
    },
  });
  const conversionMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || leadId === null
        ? Promise.reject(new Error("Lead conversion is unavailable."))
        : apiClient.convertLead(leadId, {
            version,
            customerName: conversionCustomerName.trim(),
            contactName: conversionContactName.trim(),
            contactJobTitle: conversionContactJobTitle.trim() || undefined,
          }),
    onSuccess: (conversion) => {
      setConversionResult(conversion);
      queryClient.invalidateQueries({ queryKey: leadKeys.detail(identityKey, conversion.leadId) });
      queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
      setConversionOpen(false);
    },
  });
  const collaboratorsQuery = useQuery({
    queryKey:
      leadId === null
        ? leadKeys.collaboratorBaseline(identityKey, 0)
        : leadKeys.collaboratorBaseline(identityKey, leadId),
    queryFn: () =>
      leadId === null || apiClient === null
        ? Promise.reject(new Error("Lead collaborators are unavailable."))
        : apiClient.getLeadCollaboratorBaseline(leadId),
    enabled:
      apiClient !== null && leadId !== null && collaboratorPickerOpen && canManageCollaborators,
  });
  const collaboratorMemberQuery = useQuery({
    queryKey: [
      "member-selector",
      "lead-collaborators",
      identityKey,
      collaboratorMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Member selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: collaboratorMemberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && collaboratorPickerOpen && canReadOrganization,
  });
  const collaboratorMutation = useMutation({
    mutationFn: ({
      collaborators,
      version,
    }: {
      collaborators: readonly LeadCollaborator[];
      version: number;
    }) =>
      apiClient === null || leadId === null
        ? Promise.reject(new Error("Lead collaborator update is unavailable."))
        : apiClient.replaceLeadCollaborators(leadId, {
            collaborators: [...collaborators],
            version,
          }),
    onSuccess: (updatedLead) => {
      queryClient.setQueryData(leadKeys.detail(identityKey, updatedLead.id), updatedLead);
      queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
      queryClient.invalidateQueries({
        queryKey: leadKeys.collaboratorBaseline(identityKey, updatedLead.id),
      });
      setCollaboratorPickerOpen(false);
      setCollaboratorMemberKeyword("");
      setCollaboratorDraft(null);
    },
  });
  const exitCollaboratorMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || leadId === null
        ? Promise.reject(new Error("Lead collaborator exit is unavailable."))
        : apiClient.exitLeadCollaborator(leadId, version),
    onSuccess: () => {
      if (leadId === null) return;
      queryClient.removeQueries({ queryKey: leadKeys.detail(identityKey, leadId) });
      queryClient.removeQueries({
        queryKey: leadKeys.collaboratorBaseline(identityKey, leadId),
      });
      queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
      closeDetail();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || leadId === null
        ? Promise.reject(new Error("Lead delete is unavailable."))
        : apiClient.deleteLead(leadId, version),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: leadKeys.all });
      closeDetail();
    },
  });

  if (leadId === null) return <StatusPage kind="not-found" />;

  if (leadQuery.isLoading) {
    return (
      <div
        aria-label="正在加载线索详情"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (leadQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(leadQuery.error)}
        onRetry={() => void leadQuery.refetch()}
      />
    );
  }

  const lead = leadQuery.data;
  if (lead === undefined) return <StatusPage kind="unavailable" />;
  const leadDynamicFields = serverProvidedDynamicFields(
    fieldDefinitionsQuery.data ?? [],
    lead.customFields,
  );
  const deleteConflict = getMutationConflict(deleteMutation.error);
  const customerCandidates = customerCandidateQuery.data
    ? toPageResult(customerCandidateQuery.data, toCustomerListItem).items
    : [];
  const hierarchyNames = new Map(
    (hierarchyQuery.data?.leads ?? []).map((hierarchyLead) => [
      hierarchyLead.id,
      hierarchyLead.name,
    ]),
  );
  const descendantIds = hierarchyQuery.data
    ? visibleDescendantIds(hierarchyQuery.data)
    : new Set<number>();
  const parentCandidates = parentCandidateQuery.data
    ? toPageResult(parentCandidateQuery.data, toLeadListItem).items.filter(
        (candidate) => candidate.id !== lead.id && !descendantIds.has(candidate.id),
      )
    : [];
  const currentState =
    lead.locked !== null && isLeadDealStatus(lead.dealStatus)
      ? { locked: lead.locked, dealStatus: lead.dealStatus }
      : null;
  const normalizedTagDraft = tagDraft === null ? null : normalizeLeadTagDraft(tagDraft);
  const collaboratorBaseline = collaboratorsQuery.data;
  const collaborators = collaboratorDraft ?? collaboratorBaseline?.collaborators ?? [];
  const collaboratorIds = new Set(collaborators.map((collaborator) => collaborator.actorId));
  const editableMemberOptions = (collaboratorMemberQuery.data ?? []).filter(
    (member) => member.actorId !== lead.ownerActorId && !collaboratorIds.has(member.actorId),
  );

  function editCollaborators(
    edit: (current: readonly LeadCollaborator[]) => readonly LeadCollaborator[],
  ) {
    setCollaboratorDraft((current) => {
      const source = current ?? collaboratorBaseline?.collaborators;
      return source === undefined ? current : edit(source);
    });
  }

  function closeCollaboratorPicker() {
    if (collaboratorMutation.isPending) return;
    collaboratorMutation.reset();
    setCollaboratorPickerOpen(false);
    setCollaboratorMemberKeyword("");
    setCollaboratorDraft(null);
  }

  function closeCustomerPicker() {
    if (customerMutation.isPending) return;
    customerMutation.reset();
    setCustomerPickerOpen(false);
    setCustomerKeyword("");
  }

  function closeOwnerPicker() {
    if (ownerMutation.isPending) return;
    ownerMutation.reset();
    setOwnerPickerOpen(false);
    setOwnerMemberKeyword("");
  }

  function closeParentPicker() {
    if (parentMutation.isPending) return;
    parentMutation.reset();
    setParentPickerOpen(false);
    setParentKeyword("");
  }

  function closeStatePicker() {
    if (stateMutation.isPending) return;
    stateMutation.reset();
    setStatePickerOpen(false);
    setStateDraft(null);
  }

  function openTagEditor() {
    if (leadQuery.data === undefined) return;
    tagMutation.reset();
    setTagDraft(leadQuery.data.tags);
    setTagEditorOpen(true);
  }

  function closeTagEditor() {
    if (tagMutation.isPending) return;
    tagMutation.reset();
    setTagEditorOpen(false);
    setTagDraft(null);
  }

  function closeCustomFieldEditor() {
    if (customFieldUpdateMutation.isPending) return;
    customFieldUpdateMutation.reset();
    setChangedCustomFieldCodes(new Set());
    setCustomFieldErrors({});
    setCustomFieldValues({});
    setCustomFieldMemberKeyword("");
    setCustomFieldEditorOpen(false);
  }

  function closeConversion() {
    if (conversionMutation.isPending) return;
    conversionMutation.reset();
    setConversionOpen(false);
  }

  async function resolveDeleteConflict(resolution: MutationConflictResolution) {
    if (resolution === "dismiss") {
      deleteMutation.reset();
      return;
    }

    await leadQuery.refetch();
    deleteMutation.reset();
  }

  async function resolveTagConflict(resolution: MutationConflictResolution) {
    if (resolution === "dismiss") {
      tagMutation.reset();
      return;
    }

    await leadQuery.refetch();
    if (resolution === "discard-draft-and-reload") setTagDraft(null);
    tagMutation.reset();
  }

  return (
    <RouteAuthority authority={authority.leadsRead}>
      <main className={styles.page}>
        <section className={styles.heading}>
          <div>
            <Button icon={<ArrowLeftOutlined />} type="link" onClick={closeDetail}>
              返回线索列表
            </Button>
            <div className={styles.titleRow}>
              <Typography.Title level={2}>{lead.name}</Typography.Title>
              {lead.starred ? <StarFilled aria-label="已关注" /> : null}
              {lead.locked ? (
                <Tag color="orange" icon={<LockOutlined />}>
                  已锁定
                </Tag>
              ) : null}
              {lead.status ? <Tag>{lead.status}</Tag> : null}
            </div>
            <Typography.Text type="secondary">
              基础字段以服务端响应为准；自定义字段需在取得有效字段访问上下文后显示。
            </Typography.Text>
            <div>
              <Button
                icon={lead.starred ? <StarFilled /> : <StarOutlined />}
                loading={starMutation.isPending}
                onClick={() => starMutation.mutate(!lead.starred)}
              >
                {lead.starred ? "取消关注" : "关注"}
              </Button>
              <ApprovalStartAction
                objectType="LEAD"
                subjectId={lead.id}
                onStarted={() => {
                  void queryClient.invalidateQueries({
                    queryKey: leadKeys.detail(identityKey, lead.id),
                  });
                  void queryClient.invalidateQueries({ queryKey: leadKeys.lists(identityKey) });
                }}
              />
            </div>
            {lead.status !== "CONVERTED" ? (
              <div>
                <ActionAuthority authority={authority.leadsWrite}>
                  <Button type="primary" onClick={() => navigate(`/crm/leads/${lead.id}/edit`)}>
                    编辑基础信息
                  </Button>
                  <ActionAuthority authority={authority.customersRead}>
                    <Button
                      onClick={() => {
                        customerMutation.reset();
                        setCustomerPickerOpen(true);
                      }}
                    >
                      关联客户
                    </Button>
                  </ActionAuthority>
                </ActionAuthority>
              </div>
            ) : null}
            <ActionAuthority authority={authority.leadsWrite}>
              <Button
                onClick={() => {
                  parentMutation.reset();
                  setParentPickerOpen(true);
                }}
              >
                设置上级线索
              </Button>
              {currentState ? (
                <Button
                  onClick={() => {
                    stateMutation.reset();
                    setStateDraft(currentState);
                    setStatePickerOpen(true);
                  }}
                >
                  修改状态
                </Button>
              ) : null}
            </ActionAuthority>
            <ActionAuthority authority={authority.leadsAssign}>
              <ActionAuthority authority={authority.organizationRead}>
                <Button
                  onClick={() => {
                    ownerMutation.reset();
                    setOwnerPickerOpen(true);
                  }}
                >
                  变更负责人
                </Button>
              </ActionAuthority>
              <Button
                onClick={() => {
                  collaboratorMutation.reset();
                  setCollaboratorPickerOpen(true);
                }}
              >
                管理协作者
              </Button>
            </ActionAuthority>
            <ActionAuthority authority={authority.leadsWrite}>
              <Popconfirm
                cancelText="取消"
                description="仅服务端确认当前成员为线索协作者时才会退出；负责人和其他成员不会由浏览器判断或修改。"
                okButtonProps={{ danger: true }}
                okText="确认退出"
                title="确认退出该线索协作？"
                onConfirm={() => exitCollaboratorMutation.mutate(lead.version)}
              >
                <Button danger loading={exitCollaboratorMutation.isPending}>
                  退出协作
                </Button>
              </Popconfirm>
            </ActionAuthority>
            {lead.status === "ACTIVE" ? (
              <ActionAuthority authority={authority.leadsConvert}>
                <ActionAuthority authority={authority.customersWrite}>
                  <ActionAuthority authority={authority.contactsWrite}>
                    <Button
                      type="primary"
                      onClick={() => {
                        conversionMutation.reset();
                        setConversionCustomerName(lead.name);
                        setConversionContactName(lead.name);
                        setConversionContactJobTitle(lead.jobTitle ?? "");
                        setConversionOpen(true);
                      }}
                    >
                      转换为客户和联系人
                    </Button>
                  </ActionAuthority>
                </ActionAuthority>
              </ActionAuthority>
            ) : null}
            <ActionAuthority authority={authority.leadsDelete}>
              <Popconfirm
                cancelText="取消"
                description="删除后线索会进入服务端软删除状态，并由服务端撤回其附件与文件字段绑定。服务端会再次确认当前 version，且该线索没有活动下级线索。"
                okButtonProps={{ danger: true }}
                okText="确认删除"
                title={`删除线索“${lead.name}”？`}
                onConfirm={() => {
                  deleteMutation.reset();
                  deleteMutation.mutate(lead.version);
                }}
              >
                <Button
                  danger
                  disabled={deleteMutation.isPending}
                  loading={deleteMutation.isPending}
                >
                  删除线索
                </Button>
              </Popconfirm>
            </ActionAuthority>
          </div>
        </section>

        {deleteMutation.isError && deleteConflict === null ? (
          <Alert
            title={
              deleteMutation.error instanceof ApiError
                ? deleteMutation.error.message
                : "线索暂时无法删除"
            }
            showIcon
            type="error"
          />
        ) : null}
        {exitCollaboratorMutation.isError ? (
          <Alert
            title={
              exitCollaboratorMutation.error instanceof ApiError
                ? exitCollaboratorMutation.error.message
                : "暂时无法退出线索协作"
            }
            showIcon
            type="error"
          />
        ) : null}
        {deleteMutation.isError ? (
          <MutationConflictNotice
            error={deleteMutation.error}
            onResolve={(resolution) => void resolveDeleteConflict(resolution)}
          />
        ) : null}

        <Card title="基本信息">
          <Descriptions column={{ sm: 1, md: 2 }} size="small">
            <Descriptions.Item label="线索编号">{lead.id}</Descriptions.Item>
            <Descriptions.Item label="关联客户">{displayValue(lead.customerId)}</Descriptions.Item>
            <Descriptions.Item label="负责人">{displayValue(lead.ownerActorId)}</Descriptions.Item>
            <Descriptions.Item label="上级线索">
              {displayValue(lead.parentLeadId)}
            </Descriptions.Item>
            <Descriptions.Item label="转换联系人">
              {displayValue(lead.convertedContactId)}
            </Descriptions.Item>
            <Descriptions.Item label="职务">{displayValue(lead.jobTitle)}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{displayValue(lead.phoneNumber)}</Descriptions.Item>
            <Descriptions.Item label="座机">{displayValue(lead.telephone)}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{displayValue(lead.email)}</Descriptions.Item>
            <Descriptions.Item label="网站">{displayValue(lead.website)}</Descriptions.Item>
            <Descriptions.Item label="地址" span={2}>
              {displayAddresses(lead.addresses)}
            </Descriptions.Item>
            <Descriptions.Item label="下次联系时间">
              {displayValue(lead.nextContactTime)}
            </Descriptions.Item>
            <Descriptions.Item label="成交状态">{displayValue(lead.dealStatus)}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{displayValue(lead.createdTime)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{displayValue(lead.updatedTime)}</Descriptions.Item>
          </Descriptions>
        </Card>
        {canReadFieldMetadata && fieldDefinitionsQuery.isLoading ? (
          <Card title="自定义字段">
            <Spin aria-label="正在加载线索自定义字段目录" />
          </Card>
        ) : null}
        {canReadFieldMetadata && fieldDefinitionsQuery.isError ? (
          <Card title="自定义字段">
            <Alert title="线索自定义字段目录暂时无法加载" showIcon type="error" />
          </Card>
        ) : null}
        {leadDynamicFields.length > 0 || customFormFieldDefinitions.length > 0 ? (
          <Card
            extra={
              canWriteLeads && customFormFieldDefinitions.length > 0 ? (
                <ActionAuthority authority={authority.leadsWrite}>
                  <Button
                    onClick={() => {
                      customFieldUpdateMutation.reset();
                      setChangedCustomFieldCodes(new Set());
                      setCustomFieldErrors({});
                      setCustomFieldValues({});
                      setCustomFieldMemberKeyword("");
                      setCustomFieldEditorOpen(true);
                    }}
                  >
                    编辑自定义字段
                  </Button>
                </ActionAuthority>
              ) : null
            }
            title="自定义字段"
          >
            <Typography.Paragraph type="secondary">
              值仅按服务端当前返回展示；不会作为编辑或字段权限判断的依据。
            </Typography.Paragraph>
            {leadDynamicFields.length > 0 ? (
              <ServerProvidedDynamicFieldDescriptions
                columns={{ sm: 1, xs: 1 }}
                definitions={customFieldDefinitions}
                values={lead.customFields}
              />
            ) : (
              <Typography.Text type="secondary">暂无可见字段值</Typography.Text>
            )}
          </Card>
        ) : null}
        <ControlledFileFieldDownloadCard
          canRead={canReadFileFields}
          fileFields={lead.fileFields}
          targetId={lead.id}
          targetType="lead"
          title="字段附件"
        />

        <Card title="线索层级">
          {hierarchyQuery.isLoading ? <Spin /> : null}
          {hierarchyQuery.isError ? (
            <Alert title="线索层级暂时无法加载" showIcon type="error" />
          ) : null}
          {hierarchyQuery.data ? (
            <Space orientation="vertical" size="small">
              <Typography.Text>
                上级线索：
                {lead.parentLeadId === null
                  ? "未设置"
                  : (hierarchyNames.get(lead.parentLeadId) ?? `线索 ${lead.parentLeadId}`)}
              </Typography.Text>
              <Typography.Text>
                当前可见下级线索：
                {descendantIds.size === 0
                  ? "暂无"
                  : [...descendantIds]
                      .map((id) => hierarchyNames.get(id) ?? `线索 ${id}`)
                      .join("、")}
              </Typography.Text>
            </Space>
          ) : null}
        </Card>

        {conversionResult !== null ? (
          <Card title="转换结果">
            <Descriptions
              column={{ sm: 1, md: 3 }}
              items={[
                { key: "customer", label: "新建客户", children: conversionResult.customerId },
                { key: "contact", label: "新建联系人", children: conversionResult.contactId },
                { key: "version", label: "线索版本", children: conversionResult.leadVersion },
              ]}
            />
            <Space wrap>
              {canReadCustomers ? (
                <Button onClick={() => navigate(`/crm/customers/${conversionResult.customerId}`)}>
                  查看新建客户
                </Button>
              ) : null}
              {canReadContacts ? (
                <Button onClick={() => navigate(`/crm/contacts/${conversionResult.contactId}`)}>
                  查看新建联系人
                </Button>
              ) : null}
            </Space>
          </Card>
        ) : null}

        <Card
          extra={
            <ActionAuthority authority={authority.leadsWrite}>
              <Button onClick={openTagEditor}>管理标签</Button>
            </ActionAuthority>
          }
          title="标签"
        >
          {lead.tags.length === 0 ? (
            <Typography.Text type="secondary">暂无标签</Typography.Text>
          ) : (
            <div className={styles.tags}>
              {lead.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          )}
        </Card>

        {lead.description ? (
          <Card title="备注">
            <Typography.Paragraph className={styles.description}>
              {lead.description}
            </Typography.Paragraph>
          </Card>
        ) : null}
        <ActivityTimelineCard subjectId={lead.id} subjectType="LEAD" />
      </main>
      <Modal
        destroyOnHidden
        footer={null}
        open={parentPickerOpen}
        title="设置上级线索"
        onCancel={closeParentPicker}
      >
        <Typography.Paragraph type="secondary">
          候选线索与层级关系均来自服务端可见范围。服务端会拒绝循环层级和超出容量的调整。
        </Typography.Paragraph>
        {lead.parentLeadId !== null ? (
          <Popconfirm
            cancelText="取消"
            okText="清除"
            title="确认清除当前上级线索吗？"
            onConfirm={() => parentMutation.mutate({ version: lead.version })}
          >
            <Button danger disabled={parentMutation.isPending} style={{ marginBottom: 12 }}>
              清除当前上级（{hierarchyNames.get(lead.parentLeadId) ?? lead.parentLeadId}）
            </Button>
          </Popconfirm>
        ) : null}
        <Input.Search
          allowClear
          defaultValue={parentKeyword}
          placeholder="搜索可见线索"
          onSearch={(keyword) => setParentKeyword(keyword)}
        />
        {parentCandidateQuery.isError ? (
          <Alert
            title="上级线索候选列表暂时无法加载"
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : (
          <List
            dataSource={parentCandidates}
            loading={parentCandidateQuery.isLoading}
            locale={{ emptyText: "未找到可设置为上级的线索" }}
            renderItem={(candidate) => (
              <List.Item
                actions={[
                  <Button
                    disabled={parentMutation.isPending}
                    key={candidate.id}
                    loading={parentMutation.isPending}
                    type="link"
                    onClick={() =>
                      parentMutation.mutate({
                        parentLeadId: candidate.id,
                        version: lead.version,
                      })
                    }
                  >
                    设为上级
                  </Button>,
                ]}
              >
                <List.Item.Meta description={`线索 ${candidate.id}`} title={candidate.name} />
              </List.Item>
            )}
          />
        )}
        {parentMutation.isError ? (
          <Alert
            title={
              parentMutation.error instanceof ApiError
                ? parentMutation.error.message
                : "线索上级暂时无法更新"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
      </Modal>
      <Modal
        destroyOnHidden
        footer={
          <>
            <Button disabled={stateMutation.isPending} onClick={closeStatePicker}>
              取消
            </Button>
            <Button
              disabled={stateDraft === null}
              loading={stateMutation.isPending}
              type="primary"
              onClick={() =>
                stateDraft === null
                  ? undefined
                  : stateMutation.mutate({ ...stateDraft, version: lead.version })
              }
            >
              保存状态
            </Button>
          </>
        }
        open={statePickerOpen}
        title="修改线索状态"
        onCancel={closeStatePicker}
      >
        <Typography.Paragraph type="secondary">
          锁定和成交状态由服务端一起校验并更新，保存时会使用当前详情版本。
        </Typography.Paragraph>
        {stateDraft ? (
          <>
            <Typography.Paragraph>
              锁定线索{" "}
              <Switch
                checked={stateDraft.locked}
                onChange={(locked) => setStateDraft({ ...stateDraft, locked })}
              />
            </Typography.Paragraph>
            <Select<LeadDealStatus>
              aria-label="成交状态"
              options={[
                { label: "进行中", value: "OPEN" },
                { label: "已成交", value: "WON" },
              ]}
              style={{ width: "100%" }}
              value={stateDraft.dealStatus}
              onChange={(dealStatus) => setStateDraft({ ...stateDraft, dealStatus })}
            />
          </>
        ) : null}
        {stateMutation.isError ? (
          <Alert
            title={
              stateMutation.error instanceof ApiError
                ? stateMutation.error.message
                : "线索状态暂时无法更新"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
      </Modal>
      <Modal
        destroyOnHidden
        footer={
          <>
            <Button disabled={tagMutation.isPending} onClick={closeTagEditor}>
              取消
            </Button>
            <Button
              disabled={
                normalizedTagDraft === null || tagCatalogQuery.isLoading || tagCatalogQuery.isError
              }
              loading={tagMutation.isPending}
              type="primary"
              onClick={() => {
                if (normalizedTagDraft === null) return;
                tagMutation.mutate({ tags: normalizedTagDraft, version: lead.version });
              }}
            >
              保存标签
            </Button>
          </>
        }
        open={tagEditorOpen}
        title="管理线索标签"
        onCancel={closeTagEditor}
      >
        <Typography.Paragraph type="secondary">
          先由服务端确认标签字段可读且未遮罩，再按当前详情的原始 version
          整体替换。可从已知标签选择或输入新标签；最终字段权限、数据范围与并发由服务端复核。
        </Typography.Paragraph>
        {tagCatalogQuery.isError ? (
          <Alert title="线索标签目录暂时无法加载，无法安全保存" showIcon type="error" />
        ) : (
          <Select
            aria-label="线索标签"
            disabled={tagCatalogQuery.isLoading || tagMutation.isPending}
            loading={tagCatalogQuery.isLoading}
            maxCount={50}
            mode="tags"
            options={(tagCatalogQuery.data ?? []).map((tag) => ({ label: tag, value: tag }))}
            placeholder="输入标签后按 Enter"
            style={{ width: "100%" }}
            tokenSeparators={[",", "，"]}
            value={tagDraft === null ? undefined : [...tagDraft]}
            onChange={(tags: string[]) => setTagDraft(tags)}
          />
        )}
        {tagDraft !== null && normalizedTagDraft === null ? (
          <Alert
            title="每个标签需为 1–50 个字符，最多 50 个，且不能包含规范化后的重复标签。"
            showIcon
            style={{ marginTop: 12 }}
            type="warning"
          />
        ) : null}
        {tagMutation.isError && getMutationConflict(tagMutation.error) === null ? (
          <Alert
            title={
              tagMutation.error instanceof ApiError
                ? tagMutation.error.message
                : "线索标签暂时无法更新"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
        {tagMutation.isError ? (
          <MutationConflictNotice
            error={tagMutation.error}
            onResolve={(resolution) => void resolveTagConflict(resolution)}
          />
        ) : null}
      </Modal>
      <Modal
        destroyOnHidden
        footer={
          <Space>
            <Button disabled={customFieldUpdateMutation.isPending} onClick={closeCustomFieldEditor}>
              取消
            </Button>
            <Button
              disabled={fieldDefinitionsQuery.isError || changedCustomFieldCodes.size === 0}
              loading={customFieldUpdateMutation.isPending}
              type="primary"
              onClick={() => {
                const customFieldIssues = validateCustomFieldFormValues(
                  customFieldDefinitions,
                  customFieldValues,
                ).filter((issue) => changedCustomFieldCodes.has(issue.code));
                setCustomFieldErrors(
                  Object.fromEntries(customFieldIssues.map((issue) => [issue.code, issue.message])),
                );
                if (customFieldIssues.length > 0) return;
                customFieldUpdateMutation.mutate({
                  changedCodes: changedCustomFieldCodes,
                  values: customFieldValues,
                  version: lead.version,
                });
              }}
            >
              保存修改
            </Button>
          </Space>
        }
        open={customFieldEditorOpen}
        title="编辑自定义字段"
        onCancel={closeCustomFieldEditor}
      >
        <Typography.Paragraph type="secondary">
          为避免把详情中的脱敏或只读值写回，字段均从空白开始。只有本次明确填写或清除的字段会提交；未操作字段由服务端保持当前值。
        </Typography.Paragraph>
        {fieldDefinitionsQuery.isError ? (
          <Alert title="线索自定义字段目录暂时无法加载" showIcon type="warning" />
        ) : (
          <Form layout="vertical">
            <CustomFieldFormFields
              definitions={customFieldDefinitions}
              departmentOptions={customFieldDepartmentQuery.data ?? []}
              disabled={customFieldUpdateMutation.isPending}
              errors={customFieldErrors}
              memberOptions={customFieldMemberQuery.data ?? []}
              memberOptionsLoading={customFieldMemberQuery.isLoading}
              showExplicitClear
              values={customFieldValues}
              onChange={setCustomFieldValues}
              onFieldChange={(code) => {
                setChangedCustomFieldCodes((current) => new Set(current).add(code));
                setCustomFieldErrors((current) => {
                  if (current[code] === undefined) return current;
                  return Object.fromEntries(
                    Object.entries(current).filter(([currentCode]) => currentCode !== code),
                  );
                });
              }}
              onMemberSearch={setCustomFieldMemberKeyword}
            />
          </Form>
        )}
        {hasMemberCustomField && customFieldMemberQuery.isError ? (
          <Alert
            title="自定义人员字段候选暂时无法加载；请稍后重试后再修改该类字段"
            showIcon
            type="warning"
          />
        ) : null}
        {hasDepartmentCustomField && customFieldDepartmentQuery.isError ? (
          <Alert
            title="自定义部门字段候选暂时无法加载；请稍后重试后再修改该类字段"
            showIcon
            type="warning"
          />
        ) : null}
        {customFieldUpdateMutation.isError ? (
          <Alert
            title={
              customFieldUpdateMutation.error instanceof ApiError
                ? customFieldUpdateMutation.error.message
                : "线索自定义字段暂时无法更新"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
      </Modal>
      <Modal
        destroyOnHidden
        footer={null}
        open={customerPickerOpen}
        title="关联客户"
        onCancel={closeCustomerPicker}
      >
        <Typography.Paragraph type="secondary">
          候选客户由服务端按当前成员的客户读取权限和数据范围裁剪；保存时服务端会再次校验可见性、线索状态和字段写权限。
        </Typography.Paragraph>
        {lead.customerId !== null ? (
          <Popconfirm
            cancelText="取消"
            okText="清除"
            title="确认清除当前关联客户吗？"
            onConfirm={() => customerMutation.mutate({ customerId: null, version: lead.version })}
          >
            <Button
              danger
              disabled={customerMutation.isPending}
              loading={customerMutation.isPending}
              style={{ marginBottom: 12 }}
            >
              清除当前关联客户（{lead.customerId}）
            </Button>
          </Popconfirm>
        ) : null}
        <Input.Search
          allowClear
          defaultValue={customerKeyword}
          placeholder="搜索可见客户"
          onSearch={(keyword) => setCustomerKeyword(keyword)}
        />
        {customerCandidateQuery.isError ? (
          <Alert title="客户候选列表暂时无法加载" showIcon style={{ marginTop: 12 }} type="error" />
        ) : (
          <List
            dataSource={customerCandidates}
            loading={customerCandidateQuery.isLoading}
            locale={{ emptyText: "未找到可关联的客户" }}
            renderItem={(candidate) => (
              <List.Item
                actions={[
                  <Button
                    disabled={customerMutation.isPending}
                    key={candidate.id}
                    loading={customerMutation.isPending}
                    type="link"
                    onClick={() =>
                      customerMutation.mutate({
                        customerId: candidate.id,
                        version: lead.version,
                      })
                    }
                  >
                    关联
                  </Button>,
                ]}
              >
                <List.Item.Meta description={`客户 ${candidate.id}`} title={candidate.name} />
              </List.Item>
            )}
          />
        )}
        {customerMutation.isError ? (
          <Alert
            title={
              customerMutation.error instanceof ApiError
                ? customerMutation.error.message
                : "线索关联客户暂时无法更新"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
      </Modal>
      <Modal
        destroyOnHidden
        footer={
          <>
            <Button disabled={conversionMutation.isPending} onClick={closeConversion}>
              取消
            </Button>
            <Button
              disabled={
                conversionCustomerName.trim().length === 0 ||
                conversionCustomerName.trim().length > 200 ||
                conversionContactName.trim().length === 0 ||
                conversionContactName.trim().length > 200 ||
                conversionContactJobTitle.trim().length > 200
              }
              loading={conversionMutation.isPending}
              type="primary"
              onClick={() => conversionMutation.mutate(lead.version)}
            >
              确认转换
            </Button>
          </>
        }
        open={conversionOpen}
        title="转换线索"
        onCancel={closeConversion}
      >
        <Typography.Paragraph type="secondary">
          服务端会在同一事务中创建客户和联系人，并以当前线索 version
          复核并发状态。只会跳转到本次响应明确返回的 ID。
        </Typography.Paragraph>
        <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
          <label>
            <Typography.Text>客户名称</Typography.Text>
            <Input
              aria-label="转换客户名称"
              maxLength={200}
              value={conversionCustomerName}
              onChange={(event) => setConversionCustomerName(event.target.value)}
            />
          </label>
          <label>
            <Typography.Text>联系人名称</Typography.Text>
            <Input
              aria-label="转换联系人名称"
              maxLength={200}
              value={conversionContactName}
              onChange={(event) => setConversionContactName(event.target.value)}
            />
          </label>
          <label>
            <Typography.Text>联系人职务</Typography.Text>
            <Input
              aria-label="转换联系人职务"
              maxLength={200}
              value={conversionContactJobTitle}
              onChange={(event) => setConversionContactJobTitle(event.target.value)}
            />
          </label>
        </Space>
        {conversionMutation.isError ? (
          <Alert
            title={
              conversionMutation.error instanceof ApiError
                ? conversionMutation.error.message
                : "线索暂时无法转换"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
      </Modal>
      <Modal
        destroyOnHidden
        footer={null}
        open={ownerPickerOpen}
        title="变更负责人"
        onCancel={closeOwnerPicker}
      >
        <Typography.Paragraph type="secondary">
          仅显示服务端允许当前成员查看的在职成员；最终可分配范围仍由服务端校验。
        </Typography.Paragraph>
        <Input.Search
          allowClear
          defaultValue={ownerMemberKeyword}
          placeholder="按成员姓名搜索"
          style={{ marginTop: 12 }}
          onSearch={(keyword) => setOwnerMemberKeyword(keyword)}
        />
        {ownerMemberQuery.isError ? (
          <Alert title="成员列表暂时无法加载" showIcon type="error" />
        ) : (
          <List
            dataSource={[...(ownerMemberQuery.data ?? [])]}
            loading={ownerMemberQuery.isLoading}
            locale={{ emptyText: "未找到可选择成员" }}
            renderItem={(member) => (
              <List.Item
                actions={[
                  <Button
                    disabled={ownerMutation.isPending || member.actorId === lead.ownerActorId}
                    key={member.actorId}
                    loading={ownerMutation.isPending}
                    type="link"
                    onClick={() =>
                      ownerMutation.mutate({ actorId: member.actorId, version: lead.version })
                    }
                  >
                    {member.actorId === lead.ownerActorId ? "当前负责人" : "选择"}
                  </Button>,
                ]}
              >
                <List.Item.Meta description={`成员 ${member.actorId}`} title={member.displayName} />
              </List.Item>
            )}
          />
        )}
        {ownerMutation.isError ? (
          <Alert
            title={
              ownerMutation.error instanceof ApiError
                ? ownerMutation.error.message
                : "线索负责人暂时无法更新"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
      </Modal>
      <Modal
        destroyOnHidden
        footer={
          <>
            <Button disabled={collaboratorMutation.isPending} onClick={closeCollaboratorPicker}>
              取消
            </Button>
            <Button
              disabled={
                collaboratorDraft === null ||
                collaboratorBaseline === undefined ||
                collaboratorsQuery.isError ||
                collaboratorsQuery.isLoading
              }
              loading={collaboratorMutation.isPending}
              type="primary"
              onClick={() => {
                if (collaboratorBaseline === undefined) return;
                collaboratorMutation.mutate({
                  collaborators,
                  version: collaboratorBaseline.version,
                });
              }}
            >
              保存协作者
            </Button>
          </>
        }
        open={collaboratorPickerOpen}
        title="管理协作者"
        onCancel={closeCollaboratorPicker}
      >
        <Typography.Paragraph type="secondary">
          协作者清单由服务端完整替换。读取异常时不会允许保存；最终成员范围与读写权限仍由服务端校验。
        </Typography.Paragraph>
        {collaboratorsQuery.isError ? (
          <Alert title="线索协作者暂时无法加载" showIcon type="error" />
        ) : (
          <List
            dataSource={[...collaborators]}
            loading={collaboratorsQuery.isLoading}
            locale={{ emptyText: "暂无协作者" }}
            renderItem={(collaborator) => (
              <List.Item
                actions={[
                  <Select<LeadCollaboratorAccess>
                    aria-label={`成员 ${collaborator.actorId} 的协作权限`}
                    disabled={collaboratorMutation.isPending || collaboratorBaseline === undefined}
                    key={`access-${collaborator.actorId}`}
                    options={[
                      { label: "只读", value: "READ" },
                      { label: "可编辑", value: "WRITE" },
                    ]}
                    value={collaborator.access}
                    onChange={(access) =>
                      editCollaborators((current) =>
                        current.map((item) =>
                          item.actorId === collaborator.actorId ? { ...item, access } : item,
                        ),
                      )
                    }
                  />,
                  <Button
                    danger
                    disabled={collaboratorMutation.isPending || collaboratorBaseline === undefined}
                    key={`remove-${collaborator.actorId}`}
                    type="link"
                    onClick={() =>
                      editCollaborators((current) =>
                        current.filter((item) => item.actorId !== collaborator.actorId),
                      )
                    }
                  >
                    移除
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  description={`成员 ${collaborator.actorId}`}
                  title={`成员 ${collaborator.actorId}`}
                />
              </List.Item>
            )}
          />
        )}
        {canReadOrganization ? (
          <>
            <Typography.Title level={5}>添加协作者</Typography.Title>
            <Input.Search
              allowClear
              defaultValue={collaboratorMemberKeyword}
              placeholder="按成员姓名搜索"
              onSearch={(keyword) => setCollaboratorMemberKeyword(keyword)}
            />
            {collaboratorMemberQuery.isError ? (
              <Alert title="成员列表暂时无法加载" showIcon style={{ marginTop: 12 }} type="error" />
            ) : (
              <List
                dataSource={editableMemberOptions}
                loading={collaboratorMemberQuery.isLoading}
                locale={{ emptyText: "未找到可添加成员" }}
                renderItem={(member) => (
                  <List.Item
                    actions={[
                      <Button
                        disabled={
                          collaboratorMutation.isPending || collaboratorBaseline === undefined
                        }
                        key={member.actorId}
                        type="link"
                        onClick={() =>
                          editCollaborators((current) => [
                            ...current,
                            { actorId: member.actorId, access: "READ" },
                          ])
                        }
                      >
                        添加为只读
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
            title="当前没有成员目录读取权限，无法新增协作者；仍可调整已加载的协作者权限。"
            showIcon
            style={{ marginTop: 12 }}
            type="info"
          />
        )}
        {collaboratorMutation.isError ? (
          <Alert
            title={
              collaboratorMutation.error instanceof ApiError
                ? collaboratorMutation.error.message
                : "线索协作者暂时无法更新"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : null}
      </Modal>
    </RouteAuthority>
  );
}
