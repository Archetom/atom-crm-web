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
import { contactPoolKeys } from "~/features/contact-pools";

import { contactKeys } from "../model/query-keys";
import { toCustomerListItem } from "~/features/customers";
import {
  type ContactCollaborator,
  type ContactCollaboratorAccess,
} from "../model/contact-collaborator";
import { type ContactAddress } from "../model/contact-detail";
import { toContactListItem } from "../model/contact-list-item";
import { toContactCustomFieldUpdateRequest } from "../model/contact-form";
import { visibleDescendantIds } from "../model/contact-hierarchy";
import { normalizeContactTagDraft } from "../model/contact-tag";

import styles from "./contact-detail-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

function displayValue(value: number | string | null): string {
  return value === null ? "—" : String(value);
}

function displayAddresses(addresses: readonly ContactAddress[] | undefined): string {
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

type ContactDealStatus = "OPEN" | "WON";

function isContactDealStatus(value: string | null): value is ContactDealStatus {
  return value === "OPEN" || value === "WON";
}

export function ContactDetailPage() {
  const { contactId: contactIdParam } = useParams();
  return <ContactDetailSurface contactId={parseRouteId(contactIdParam)} />;
}

export function ContactDetailSurface({
  contactId,
  onClose,
}: Readonly<{
  contactId: number | null;
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
    navigate("/crm/contacts", { replace: true });
  }
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [releasePoolPickerOpen, setReleasePoolPickerOpen] = useState(false);
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [memberKeyword, setMemberKeyword] = useState("");
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [parentKeyword, setParentKeyword] = useState("");
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [stateDraft, setStateDraft] = useState<{
    locked: boolean;
    dealStatus: ContactDealStatus;
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
  const [collaboratorDraft, setCollaboratorDraft] = useState<readonly ContactCollaborator[] | null>(
    null,
  );
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canReadContactPools = hasAuthority(authorization, authority.contactPoolsRead);
  const canReadFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadFileFields =
    hasAuthority(authorization, authority.contactsRead) &&
    hasAuthority(authorization, authority.filesRead);
  const canManageCollaborators = hasAuthority(authorization, authority.contactsAssign);
  const canWriteContacts = hasAuthority(authorization, authority.contactsWrite);
  const contactQuery = useQuery({
    queryKey:
      contactId === null
        ? contactKeys.detail(identityKey, 0)
        : contactKeys.detail(identityKey, contactId),
    queryFn: () =>
      contactId === null || apiClient === null
        ? Promise.reject(new Error("Contact detail is unavailable."))
        : apiClient.getContact(contactId),
    enabled: apiClient !== null && contactId !== null,
  });
  const fieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "CONTACT", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Contact field definitions are unavailable."))
        : apiClient.getFieldDefinitions("CONTACT"),
    enabled: apiClient !== null && contactId !== null && canReadFieldMetadata,
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
      "contact-detail-custom-field-member-selector",
      identityKey,
      customFieldMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("联系人自定义人员字段的成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled:
      apiClient !== null && customFieldEditorOpen && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["contact-detail-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("联系人自定义部门字段的部门目录暂时不可用。"))
        : apiClient.getVisibleDepartments(),
    enabled:
      apiClient !== null &&
      customFieldEditorOpen &&
      canReadOrganization &&
      hasDepartmentCustomField,
  });
  const tagCatalogQuery = useQuery({
    queryKey: ["contact-tag-catalog", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Contact tag catalog is unavailable."))
        : apiClient.getContactTagCatalog(),
    enabled: apiClient !== null && tagEditorOpen && canWriteContacts,
  });
  const starMutation = useMutation({
    mutationFn: (starred: boolean) =>
      apiClient === null || contactId === null
        ? Promise.reject(new Error("Contact star is unavailable."))
        : apiClient.setContactStarred(contactId, { starred }),
    onSuccess: async (_, starred) => {
      if (contactId === null) return;
      await queryClient.cancelQueries({ queryKey: contactKeys.detail(identityKey, contactId) });
      queryClient.setQueryData(
        contactKeys.detail(identityKey, contactId),
        (current: typeof contactQuery.data) =>
          current === undefined ? current : { ...current, starred },
      );
      queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
    },
  });
  const customerCandidateQuery = useQuery({
    queryKey: ["contact-customer-selector", identityKey, customerKeyword] as const,
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
      apiClient === null || contactId === null
        ? Promise.reject(new Error("Contact customer update is unavailable."))
        : apiClient.updateContact(contactId, { customerId, version }),
    onSuccess: (contact) => {
      queryClient.setQueryData(contactKeys.detail(identityKey, contact.id), contact);
      queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
      setCustomerPickerOpen(false);
      setCustomerKeyword("");
    },
  });
  const releasePoolCatalogQuery = useQuery({
    queryKey: contactPoolKeys.catalog(identityKey),
    queryFn: () =>
      apiClient?.getContactPoolCatalog() ??
      Promise.reject(new Error("Contact pool catalog API is unavailable.")),
    enabled: apiClient !== null && releasePoolPickerOpen && canReadContactPools,
  });
  const releaseMutation = useMutation({
    mutationFn: ({ poolId, version }: { poolId: number; version: number }) =>
      apiClient === null || contactId === null
        ? Promise.reject(new Error("Contact pool release is unavailable."))
        : apiClient.releaseContactToPool(poolId, {
            contacts: [{ contactId, version }],
          }),
    onSuccess: (_, { poolId }) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
      queryClient.invalidateQueries({ queryKey: contactPoolKeys.all });
      setReleasePoolPickerOpen(false);
      navigate(`/crm/contact-pools/${poolId}`);
    },
  });
  const memberQuery = useQuery({
    queryKey: ["member-selector", "contact-owner", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Member selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: memberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && ownerPickerOpen && canReadOrganization,
  });
  const ownerMutation = useMutation({
    mutationFn: ({ actorId, version }: { actorId: number; version: number }) =>
      apiClient === null || contactId === null
        ? Promise.reject(new Error("Contact owner update is unavailable."))
        : apiClient.updateContactOwner(contactId, { ownerActorId: actorId, version }),
    onSuccess: (contact) => {
      queryClient.setQueryData(contactKeys.detail(identityKey, contact.id), contact);
      queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
      setOwnerPickerOpen(false);
      setMemberKeyword("");
    },
  });
  const hierarchyQuery = useQuery({
    queryKey:
      contactId === null
        ? contactKeys.hierarchy(identityKey, 0)
        : contactKeys.hierarchy(identityKey, contactId),
    queryFn: () =>
      contactId === null || apiClient === null
        ? Promise.reject(new Error("Contact hierarchy is unavailable."))
        : apiClient.getContactHierarchy(contactId),
    enabled: apiClient !== null && contactId !== null,
  });
  const parentCandidateQuery = useQuery({
    queryKey: ["contact-parent-selector", identityKey, parentKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Contact parent selection is unavailable."))
        : apiClient.getContacts({
            page: 1,
            size: 50,
            keyword: parentKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && parentPickerOpen,
  });
  const parentMutation = useMutation({
    mutationFn: ({ parentContactId, version }: { parentContactId?: number; version: number }) =>
      apiClient === null || contactId === null
        ? Promise.reject(new Error("Contact parent update is unavailable."))
        : apiClient.updateContactParent(contactId, { parentContactId, version }),
    onSuccess: (contact) => {
      queryClient.setQueryData(contactKeys.detail(identityKey, contact.id), contact);
      queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
      queryClient.invalidateQueries({ queryKey: contactKeys.hierarchy(identityKey, contact.id) });
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
      dealStatus: ContactDealStatus;
      version: number;
    }) =>
      apiClient === null || contactId === null
        ? Promise.reject(new Error("Contact state update is unavailable."))
        : apiClient.updateContactState(contactId, { locked, dealStatus, version }),
    onSuccess: (updatedContact) => {
      queryClient.setQueryData(contactKeys.detail(identityKey, updatedContact.id), updatedContact);
      queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
      setStatePickerOpen(false);
      setStateDraft(null);
    },
  });
  const tagMutation = useMutation({
    mutationFn: ({ tags, version }: { tags: readonly string[]; version: number }) =>
      apiClient === null || contactId === null
        ? Promise.reject(new Error("Contact tag update is unavailable."))
        : apiClient.replaceContactTags(contactId, { tags: [...tags], version }),
    onSuccess: (updatedContact) => {
      queryClient.setQueryData(contactKeys.detail(identityKey, updatedContact.id), updatedContact);
      queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
      queryClient.invalidateQueries({ queryKey: ["contact-tag-catalog", identityKey] });
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
      apiClient === null || contactId === null
        ? Promise.reject(new Error("Contact custom-field update is unavailable."))
        : apiClient
            .updateContact(
              contactId,
              toContactCustomFieldUpdateRequest(customFieldDefinitions, {
                changedCodes,
                customFields: values,
                version,
              }),
            )
            .then((updatedContact) => {
              if (updatedContact.id !== contactId) {
                throw new Error("更新联系人响应暂时不可用，请稍后重试。");
              }
              return updatedContact;
            }),
    onSuccess: (updatedContact) => {
      queryClient.setQueryData(contactKeys.detail(identityKey, updatedContact.id), updatedContact);
      void queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
      setChangedCustomFieldCodes(new Set());
      setCustomFieldErrors({});
      setCustomFieldValues({});
      setCustomFieldMemberKeyword("");
      setCustomFieldEditorOpen(false);
    },
  });
  const collaboratorsQuery = useQuery({
    queryKey:
      contactId === null
        ? contactKeys.collaboratorBaseline(identityKey, 0)
        : contactKeys.collaboratorBaseline(identityKey, contactId),
    queryFn: () =>
      contactId === null || apiClient === null
        ? Promise.reject(new Error("Contact collaborators are unavailable."))
        : apiClient.getContactCollaboratorBaseline(contactId),
    enabled:
      apiClient !== null && contactId !== null && collaboratorPickerOpen && canManageCollaborators,
  });
  const collaboratorMemberQuery = useQuery({
    queryKey: [
      "member-selector",
      "contact-collaborators",
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
      collaborators: readonly ContactCollaborator[];
      version: number;
    }) =>
      apiClient === null || contactId === null
        ? Promise.reject(new Error("Contact collaborator update is unavailable."))
        : apiClient.replaceContactCollaborators(contactId, {
            collaborators: [...collaborators],
            version,
          }),
    onSuccess: (contact) => {
      queryClient.setQueryData(contactKeys.detail(identityKey, contact.id), contact);
      queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
      queryClient.invalidateQueries({
        queryKey: contactKeys.collaboratorBaseline(identityKey, contact.id),
      });
      setCollaboratorPickerOpen(false);
      setCollaboratorMemberKeyword("");
      setCollaboratorDraft(null);
    },
  });
  const exitCollaboratorMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || contactId === null
        ? Promise.reject(new Error("Contact collaborator exit is unavailable."))
        : apiClient.exitContactCollaborator(contactId, version),
    onSuccess: () => {
      if (contactId === null) return;
      queryClient.removeQueries({ queryKey: contactKeys.detail(identityKey, contactId) });
      queryClient.removeQueries({
        queryKey: contactKeys.collaboratorBaseline(identityKey, contactId),
      });
      queryClient.invalidateQueries({ queryKey: contactKeys.lists(identityKey) });
      closeDetail();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || contactId === null
        ? Promise.reject(new Error("Contact delete is unavailable."))
        : apiClient.deleteContact(contactId, version),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: contactKeys.all });
      queryClient.invalidateQueries({ queryKey: contactPoolKeys.all });
      closeDetail();
    },
  });

  if (contactId === null) return <StatusPage kind="not-found" />;

  if (contactQuery.isLoading) {
    return (
      <div
        aria-label="正在加载联系人详情"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (contactQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(contactQuery.error)}
        onRetry={() => void contactQuery.refetch()}
      />
    );
  }

  const contact = contactQuery.data;
  if (contact === undefined) return <StatusPage kind="unavailable" />;
  const contactDynamicFields = serverProvidedDynamicFields(
    fieldDefinitionsQuery.data ?? [],
    contact.customFields,
  );
  const deleteConflict = getMutationConflict(deleteMutation.error);
  const customerCandidates = customerCandidateQuery.data
    ? toPageResult(customerCandidateQuery.data, toCustomerListItem).items
    : [];
  const hierarchyNames = new Map(
    (hierarchyQuery.data?.contacts ?? []).map((hierarchyContact) => [
      hierarchyContact.id,
      hierarchyContact.name,
    ]),
  );
  const descendantIds = hierarchyQuery.data
    ? visibleDescendantIds(hierarchyQuery.data)
    : new Set<number>();
  const parentCandidates = parentCandidateQuery.data
    ? toPageResult(parentCandidateQuery.data, toContactListItem).items.filter(
        (candidate) => candidate.id !== contact.id && !descendantIds.has(candidate.id),
      )
    : [];
  const currentState =
    contact.locked !== null && isContactDealStatus(contact.dealStatus)
      ? { locked: contact.locked, dealStatus: contact.dealStatus }
      : null;
  const normalizedTagDraft = tagDraft === null ? null : normalizeContactTagDraft(tagDraft);
  const collaboratorBaseline = collaboratorsQuery.data;
  const collaborators = collaboratorDraft ?? collaboratorBaseline?.collaborators ?? [];
  const collaboratorIds = new Set(collaborators.map((collaborator) => collaborator.actorId));
  const editableMemberOptions = (collaboratorMemberQuery.data ?? []).filter(
    (member) => member.actorId !== contact.ownerActorId && !collaboratorIds.has(member.actorId),
  );
  const activeReleasePools = (releasePoolCatalogQuery.data ?? []).filter(
    (pool) => pool.status === "ACTIVE",
  );

  function closeCustomerPicker() {
    if (customerMutation.isPending) return;
    customerMutation.reset();
    setCustomerPickerOpen(false);
    setCustomerKeyword("");
  }

  function closeReleasePoolPicker() {
    if (releaseMutation.isPending) return;
    releaseMutation.reset();
    setReleasePoolPickerOpen(false);
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
    if (contactQuery.data === undefined) return;
    tagMutation.reset();
    setTagDraft(contactQuery.data.tags);
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

  function editCollaborators(
    edit: (current: readonly ContactCollaborator[]) => readonly ContactCollaborator[],
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

  async function resolveDeleteConflict(resolution: MutationConflictResolution) {
    if (resolution === "dismiss") {
      deleteMutation.reset();
      return;
    }

    await contactQuery.refetch();
    deleteMutation.reset();
  }

  async function resolveTagConflict(resolution: MutationConflictResolution) {
    if (resolution === "dismiss") {
      tagMutation.reset();
      return;
    }

    await contactQuery.refetch();
    if (resolution === "discard-draft-and-reload") setTagDraft(null);
    tagMutation.reset();
  }

  return (
    <RouteAuthority authority={authority.contactsRead}>
      <>
        <main className={styles.page}>
          <section className={styles.heading}>
            <div>
              <Button icon={<ArrowLeftOutlined />} type="link" onClick={closeDetail}>
                返回联系人列表
              </Button>
              <div className={styles.titleRow}>
                <Typography.Title level={2}>{contact.name}</Typography.Title>
                {contact.starred ? <StarFilled aria-label="已关注" /> : null}
                {contact.locked ? (
                  <Tag color="orange" icon={<LockOutlined />}>
                    已锁定
                  </Tag>
                ) : null}
                {contact.status ? <Tag>{contact.status}</Tag> : null}
              </div>
              <Typography.Text type="secondary">
                基础字段以服务端响应为准；自定义字段需在取得有效字段访问上下文后显示。
              </Typography.Text>
              <div>
                <Button
                  icon={contact.starred ? <StarFilled /> : <StarOutlined />}
                  loading={starMutation.isPending}
                  onClick={() => starMutation.mutate(!contact.starred)}
                >
                  {contact.starred ? "取消关注" : "关注"}
                </Button>
                <ApprovalStartAction
                  objectType="CONTACT"
                  subjectId={contact.id}
                  onStarted={() => {
                    void queryClient.invalidateQueries({
                      queryKey: contactKeys.detail(identityKey, contact.id),
                    });
                    void queryClient.invalidateQueries({
                      queryKey: contactKeys.lists(identityKey),
                    });
                  }}
                />
                <ActionAuthority authority={authority.contactsWrite}>
                  <Button
                    type="primary"
                    onClick={() => navigate(`/crm/contacts/${contact.id}/edit`)}
                  >
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
                  <Button
                    onClick={() => {
                      parentMutation.reset();
                      setParentPickerOpen(true);
                    }}
                  >
                    设置上级联系人
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
                <ActionAuthority authority={authority.contactsAssign}>
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
                <ActionAuthority authority={authority.contactsWrite}>
                  <Popconfirm
                    cancelText="取消"
                    description="仅服务端确认当前成员为联系人协作者时才会退出；负责人和其他成员不会由浏览器判断或修改。"
                    okButtonProps={{ danger: true }}
                    okText="确认退出"
                    title="确认退出该联系人协作？"
                    onConfirm={() => exitCollaboratorMutation.mutate(contact.version)}
                  >
                    <Button danger loading={exitCollaboratorMutation.isPending}>
                      退出协作
                    </Button>
                  </Popconfirm>
                </ActionAuthority>
                {contact.status === "ACTIVE" ? (
                  <ActionAuthority authority={authority.contactsWrite}>
                    <ActionAuthority authority={authority.contactPoolsRead}>
                      <ActionAuthority authority={authority.contactPoolsRelease}>
                        <Button
                          onClick={() => {
                            releaseMutation.reset();
                            setReleasePoolPickerOpen(true);
                          }}
                        >
                          移入联系人公海
                        </Button>
                      </ActionAuthority>
                    </ActionAuthority>
                  </ActionAuthority>
                ) : null}
                <ActionAuthority authority={authority.contactsDelete}>
                  <Popconfirm
                    cancelText="取消"
                    description="删除后联系人会进入服务端软删除状态，并由服务端撤回其附件与文件字段绑定。服务端会再次确认当前 version，且该联系人没有活动下级联系人。"
                    okButtonProps={{ danger: true }}
                    okText="确认删除"
                    title={`删除联系人“${contact.name}”？`}
                    onConfirm={() => {
                      deleteMutation.reset();
                      deleteMutation.mutate(contact.version);
                    }}
                  >
                    <Button
                      danger
                      disabled={deleteMutation.isPending}
                      loading={deleteMutation.isPending}
                    >
                      删除联系人
                    </Button>
                  </Popconfirm>
                </ActionAuthority>
              </div>
            </div>
          </section>

          {deleteMutation.isError && deleteConflict === null ? (
            <Alert
              title={
                deleteMutation.error instanceof ApiError
                  ? deleteMutation.error.message
                  : "联系人暂时无法删除"
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
                  : "暂时无法退出联系人协作"
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
            <Descriptions
              column={{ xs: 1, sm: 2, lg: 3 }}
              items={[
                { key: "id", label: "联系人编号", children: contact.id },
                { key: "customer", label: "关联客户", children: displayValue(contact.customerId) },
                { key: "owner", label: "负责人", children: displayValue(contact.ownerActorId) },
                {
                  key: "parent",
                  label: "上级联系人",
                  children: displayValue(contact.parentContactId),
                },
                { key: "job", label: "职务", children: displayValue(contact.jobTitle) },
                { key: "phone", label: "联系电话", children: displayValue(contact.phoneNumber) },
                { key: "telephone", label: "座机", children: displayValue(contact.telephone) },
                { key: "email", label: "邮箱", children: displayValue(contact.email) },
                { key: "website", label: "网站", children: displayValue(contact.website) },
                {
                  key: "addresses",
                  label: "地址",
                  span: 2,
                  children: displayAddresses(contact.addresses),
                },
                {
                  key: "next",
                  label: "下次联系时间",
                  children: displayValue(contact.nextContactTime),
                },
                { key: "deal", label: "成交状态", children: displayValue(contact.dealStatus) },
                { key: "created", label: "创建时间", children: displayValue(contact.createdTime) },
                { key: "updated", label: "更新时间", children: displayValue(contact.updatedTime) },
              ]}
            />
          </Card>
          {canReadFieldMetadata && fieldDefinitionsQuery.isLoading ? (
            <Card title="自定义字段">
              <Spin aria-label="正在加载联系人自定义字段目录" />
            </Card>
          ) : null}
          {canReadFieldMetadata && fieldDefinitionsQuery.isError ? (
            <Card title="自定义字段">
              <Alert title="联系人自定义字段目录暂时无法加载" showIcon type="error" />
            </Card>
          ) : null}
          {contactDynamicFields.length > 0 || customFormFieldDefinitions.length > 0 ? (
            <Card
              extra={
                canWriteContacts && customFormFieldDefinitions.length > 0 ? (
                  <ActionAuthority authority={authority.contactsWrite}>
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
              {contactDynamicFields.length > 0 ? (
                <ServerProvidedDynamicFieldDescriptions
                  columns={{ sm: 1, xs: 1 }}
                  definitions={customFieldDefinitions}
                  values={contact.customFields}
                />
              ) : (
                <Typography.Text type="secondary">暂无可见字段值</Typography.Text>
              )}
            </Card>
          ) : null}
          <ControlledFileFieldDownloadCard
            canRead={canReadFileFields}
            fileFields={contact.fileFields}
            targetId={contact.id}
            targetType="contact"
            title="字段附件"
          />

          <Card title="联系人层级">
            {hierarchyQuery.isLoading ? <Spin /> : null}
            {hierarchyQuery.isError ? (
              <Alert title="联系人层级暂时无法加载" showIcon type="error" />
            ) : null}
            {hierarchyQuery.data ? (
              <Space orientation="vertical" size="small">
                <Typography.Text>
                  上级联系人：
                  {contact.parentContactId === null
                    ? "未设置"
                    : (hierarchyNames.get(contact.parentContactId) ??
                      `联系人 ${contact.parentContactId}`)}
                </Typography.Text>
                <Typography.Text>
                  当前可见下级联系人：
                  {descendantIds.size === 0
                    ? "暂无"
                    : [...descendantIds]
                        .map((id) => hierarchyNames.get(id) ?? `联系人 ${id}`)
                        .join("、")}
                </Typography.Text>
              </Space>
            ) : null}
          </Card>

          <Card
            extra={
              <ActionAuthority authority={authority.contactsWrite}>
                <Button onClick={openTagEditor}>管理标签</Button>
              </ActionAuthority>
            }
            title="标签"
          >
            {contact.tags.length === 0 ? (
              <Typography.Text type="secondary">暂无标签</Typography.Text>
            ) : (
              <div className={styles.tags}>
                {contact.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            )}
          </Card>

          <Card title="说明">
            <Typography.Paragraph className={styles.description}>
              {contact.description ?? "暂无说明"}
            </Typography.Paragraph>
          </Card>
          <ActivityTimelineCard subjectId={contact.id} subjectType="CONTACT" />
        </main>
        <Modal
          destroyOnHidden
          footer={null}
          open={releasePoolPickerOpen}
          title="移入联系人公海"
          onCancel={closeReleasePoolPicker}
        >
          <Typography.Paragraph type="secondary">
            仅列出服务端确认当前成员可访问的启用公海。提交会携带当前联系人
            version，联系人写入范围、公海资格与并发状态均由服务端再次校验。
          </Typography.Paragraph>
          {releasePoolCatalogQuery.isError ? (
            <Alert title="联系人公海目录暂时无法加载" showIcon type="error" />
          ) : (
            <List
              dataSource={activeReleasePools}
              loading={releasePoolCatalogQuery.isLoading}
              locale={{ emptyText: "暂无可移入的联系人公海" }}
              renderItem={(pool) => (
                <List.Item
                  actions={[
                    <Button
                      disabled={releaseMutation.isPending}
                      key={pool.id}
                      loading={releaseMutation.isPending}
                      type="link"
                      onClick={() =>
                        releaseMutation.mutate({ poolId: pool.id, version: contact.version })
                      }
                    >
                      移入此公海
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    description={`服务端当前统计：${pool.contactCount} 位联系人`}
                    title={pool.name}
                  />
                </List.Item>
              )}
            />
          )}
          {releaseMutation.isError ? (
            <Alert
              title={
                releaseMutation.error instanceof ApiError
                  ? releaseMutation.error.message
                  : "联系人暂时无法移入公海"
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
          onCancel={() => {
            if (ownerMutation.isPending) return;
            ownerMutation.reset();
            setOwnerPickerOpen(false);
            setMemberKeyword("");
          }}
        >
          <Typography.Paragraph type="secondary">
            仅显示服务端允许当前成员查看的在职成员；最终可分配范围仍由服务端校验。
          </Typography.Paragraph>
          <Input.Search
            allowClear
            defaultValue={memberKeyword}
            placeholder="按成员姓名搜索"
            style={{ marginTop: 12 }}
            onSearch={(keyword) => setMemberKeyword(keyword)}
          />
          {memberQuery.isError ? (
            <Alert title="成员列表暂时无法加载" showIcon type="error" />
          ) : (
            <List
              dataSource={[...(memberQuery.data ?? [])]}
              loading={memberQuery.isLoading}
              locale={{ emptyText: "未找到可选择成员" }}
              renderItem={(member) => (
                <List.Item
                  actions={[
                    <Button
                      disabled={ownerMutation.isPending || member.actorId === contact.ownerActorId}
                      key={member.actorId}
                      loading={ownerMutation.isPending}
                      type="link"
                      onClick={() =>
                        ownerMutation.mutate({ actorId: member.actorId, version: contact.version })
                      }
                    >
                      {member.actorId === contact.ownerActorId ? "当前负责人" : "选择"}
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
          {ownerMutation.isError ? (
            <Alert
              title={
                ownerMutation.error instanceof ApiError
                  ? ownerMutation.error.message
                  : "联系人负责人暂时无法更新"
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
            <Alert title="联系人协作者暂时无法加载" showIcon type="error" />
          ) : (
            <List
              dataSource={[...collaborators]}
              loading={collaboratorsQuery.isLoading}
              locale={{ emptyText: "暂无协作者" }}
              renderItem={(collaborator) => (
                <List.Item
                  actions={[
                    <Select<ContactCollaboratorAccess>
                      aria-label={`成员 ${collaborator.actorId} 的协作权限`}
                      disabled={
                        collaboratorMutation.isPending || collaboratorBaseline === undefined
                      }
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
                      disabled={
                        collaboratorMutation.isPending || collaboratorBaseline === undefined
                      }
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
                <Alert
                  title="成员列表暂时无法加载"
                  showIcon
                  style={{ marginTop: 12 }}
                  type="error"
                />
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
                  : "联系人协作者暂时无法更新"
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
            候选客户由服务端按当前成员的客户读取权限和数据范围裁剪；保存时服务端会再次校验可见性和字段写权限。
          </Typography.Paragraph>
          {contact.customerId !== null ? (
            <Popconfirm
              cancelText="取消"
              okText="清除"
              title="确认清除当前关联客户吗？"
              onConfirm={() =>
                customerMutation.mutate({ customerId: null, version: contact.version })
              }
            >
              <Button
                danger
                disabled={customerMutation.isPending}
                loading={customerMutation.isPending}
                style={{ marginBottom: 12 }}
              >
                清除当前关联客户（{contact.customerId}）
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
            <Alert
              title="客户候选列表暂时无法加载"
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
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
                          version: contact.version,
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
                  : "联系人关联客户暂时无法更新"
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
          open={parentPickerOpen}
          title="设置上级联系人"
          onCancel={closeParentPicker}
        >
          <Typography.Paragraph type="secondary">
            候选联系人与层级关系均来自服务端可见范围。服务端会拒绝循环层级和超出容量的调整。
          </Typography.Paragraph>
          {contact.parentContactId !== null ? (
            <Popconfirm
              cancelText="取消"
              okText="清除"
              title="确认清除当前上级联系人吗？"
              onConfirm={() => parentMutation.mutate({ version: contact.version })}
            >
              <Button danger disabled={parentMutation.isPending} style={{ marginBottom: 12 }}>
                清除当前上级（
                {hierarchyNames.get(contact.parentContactId) ?? contact.parentContactId}）
              </Button>
            </Popconfirm>
          ) : null}
          <Input.Search
            allowClear
            defaultValue={parentKeyword}
            placeholder="搜索可见联系人"
            onSearch={(keyword) => setParentKeyword(keyword)}
          />
          {parentCandidateQuery.isError ? (
            <Alert
              title="上级联系人候选列表暂时无法加载"
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : (
            <List
              dataSource={parentCandidates}
              loading={parentCandidateQuery.isLoading}
              locale={{ emptyText: "未找到可设置为上级的联系人" }}
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
                          parentContactId: candidate.id,
                          version: contact.version,
                        })
                      }
                    >
                      设为上级
                    </Button>,
                  ]}
                >
                  <List.Item.Meta description={`联系人 ${candidate.id}`} title={candidate.name} />
                </List.Item>
              )}
            />
          )}
          {parentMutation.isError ? (
            <Alert
              title={
                parentMutation.error instanceof ApiError
                  ? parentMutation.error.message
                  : "联系人上级暂时无法更新"
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
                    : stateMutation.mutate({ ...stateDraft, version: contact.version })
                }
              >
                保存状态
              </Button>
            </>
          }
          open={statePickerOpen}
          title="修改联系人状态"
          onCancel={closeStatePicker}
        >
          <Typography.Paragraph type="secondary">
            锁定和成交状态由服务端一起校验并更新，保存时会使用当前详情版本。
          </Typography.Paragraph>
          {stateDraft ? (
            <>
              <Typography.Paragraph>
                锁定联系人{" "}
                <Switch
                  checked={stateDraft.locked}
                  onChange={(locked) => setStateDraft({ ...stateDraft, locked })}
                />
              </Typography.Paragraph>
              <Select<ContactDealStatus>
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
                  : "联系人状态暂时无法更新"
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
                  normalizedTagDraft === null ||
                  tagCatalogQuery.isLoading ||
                  tagCatalogQuery.isError
                }
                loading={tagMutation.isPending}
                type="primary"
                onClick={() => {
                  if (normalizedTagDraft === null) return;
                  tagMutation.mutate({ tags: normalizedTagDraft, version: contact.version });
                }}
              >
                保存标签
              </Button>
            </>
          }
          open={tagEditorOpen}
          title="管理联系人标签"
          onCancel={closeTagEditor}
        >
          <Typography.Paragraph type="secondary">
            先由服务端确认标签字段可读且未遮罩，再按当前详情的原始 version
            整体替换。可从已知标签选择或输入新标签；最终字段权限、数据范围与并发由服务端复核。
          </Typography.Paragraph>
          {tagCatalogQuery.isError ? (
            <Alert title="联系人标签目录暂时无法加载，无法安全保存" showIcon type="error" />
          ) : (
            <Select
              aria-label="联系人标签"
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
                  : "联系人标签暂时无法更新"
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
              <Button
                disabled={customFieldUpdateMutation.isPending}
                onClick={closeCustomFieldEditor}
              >
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
                    Object.fromEntries(
                      customFieldIssues.map((issue) => [issue.code, issue.message]),
                    ),
                  );
                  if (customFieldIssues.length > 0) return;
                  customFieldUpdateMutation.mutate({
                    changedCodes: changedCustomFieldCodes,
                    values: customFieldValues,
                    version: contact.version,
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
            <Alert title="联系人自定义字段目录暂时无法加载" showIcon type="warning" />
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
                  : "联系人自定义字段暂时无法更新"
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : null}
        </Modal>
      </>
    </RouteAuthority>
  );
}
