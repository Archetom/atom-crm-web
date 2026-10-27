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
  Tabs,
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
import { toPageResult } from "~/components/data-view/pagination";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";
import { ControlledFileFieldDownloadCard } from "~/components/controlled-file-field";
import {
  CustomFieldFormFields,
  createFieldMetadataQueryKeys,
  customFieldFormDefinitions,
  serverProvidedDynamicFields,
  ServerProvidedDynamicFieldDescriptions,
  validateCustomFieldFormValues,
  type CustomFieldValues,
} from "~/components/dynamic-field";
import { DetailWorkspace } from "~/components/page/detail-workspace";
import { ActivityTimelineCard } from "~/features/activities";
import { ApprovalStartAction } from "~/features/approvals";
import { decodeCustomerPoolCatalog } from "~/features/customer-pools";
import { customerPoolKeys } from "~/features/customer-pools";
import { EmbeddedPagePanel } from "~/features/embedded-pages";
import { StageWorkflowStartModal } from "~/features/stage-workflows";
import {
  MutationConflictNotice,
  type MutationConflictResolution,
} from "~/components/feedback/mutation-conflict-notice";

import {
  CustomerBusinessOverviewCards,
  CustomerBusinessOverviewUnavailable,
} from "../components/customer-business-overview";
import {
  type CustomerCollaborator,
  type CustomerCollaboratorAccess,
} from "../model/customer-collaborator";
import { customerKeys } from "../model/query-keys";
import { toCustomerCustomFieldUpdateRequest } from "../model/customer-form";
import { toCustomerListItem } from "../model/customer-list-item";
import { normalizeCustomerTagDraft } from "../model/customer-tag";
import { visibleDescendantIds } from "../model/customer-hierarchy";

import styles from "./customer-detail-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

function displayValue(value: number | string | null): string {
  return value === null ? "—" : String(value);
}

type CustomerDealStatus = "OPEN" | "WON";

function isCustomerDealStatus(value: string | null): value is CustomerDealStatus {
  return value === "OPEN" || value === "WON";
}

export function CustomerDetailPage() {
  const { customerId: customerIdParam } = useParams();
  return <CustomerDetailSurface customerId={parseRouteId(customerIdParam)} />;
}

export function CustomerDetailSurface({
  customerId,
  onClose,
}: Readonly<{
  customerId: number | null;
  onClose?: () => void;
}>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [memberKeyword, setMemberKeyword] = useState("");
  const [collaboratorPickerOpen, setCollaboratorPickerOpen] = useState(false);
  const [collaboratorMemberKeyword, setCollaboratorMemberKeyword] = useState("");
  const [collaboratorDraft, setCollaboratorDraft] = useState<
    readonly CustomerCollaborator[] | null
  >(null);
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [parentKeyword, setParentKeyword] = useState("");
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [stateDraft, setStateDraft] = useState<{
    locked: boolean;
    dealStatus: CustomerDealStatus;
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
  const [stageWorkflowStartOpen, setStageWorkflowStartOpen] = useState(false);
  const [releasePoolPickerOpen, setReleasePoolPickerOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState("activity");
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canReadFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadCustomerFileFields =
    hasAuthority(authorization, authority.customersRead) &&
    hasAuthority(authorization, authority.filesRead);
  const canManageCollaborators = hasAuthority(authorization, authority.customersAssign);
  const canWriteCustomers = hasAuthority(authorization, authority.customersWrite);
  const canReadCustomerPools = hasAuthority(authorization, authority.customerPoolsRead);
  const customerQuery = useQuery({
    queryKey:
      customerId === null
        ? customerKeys.detail(identityKey, 0)
        : customerKeys.detail(identityKey, customerId),
    queryFn: () =>
      customerId === null || apiClient === null
        ? Promise.reject(new Error("Customer detail is unavailable."))
        : apiClient.getCustomer(customerId),
    enabled: apiClient !== null && customerId !== null,
  });
  const fieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "CUSTOMER", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("客户字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("CUSTOMER"),
    enabled:
      apiClient !== null &&
      customerId !== null &&
      activeDetailTab === "details" &&
      canReadFieldMetadata,
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
      "customer-detail-custom-field-member-selector",
      identityKey,
      customFieldMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("客户自定义人员字段的成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled:
      apiClient !== null && customFieldEditorOpen && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["customer-detail-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("客户自定义部门字段的部门目录暂时不可用。"))
        : apiClient.getVisibleDepartments(),
    enabled:
      apiClient !== null &&
      customFieldEditorOpen &&
      canReadOrganization &&
      hasDepartmentCustomField,
  });
  const starMutation = useMutation({
    mutationFn: (starred: boolean) =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer star is unavailable."))
        : apiClient.setCustomerStarred(customerId, { starred }),
    onSuccess: async (_, starred) => {
      if (customerId === null) return;
      await queryClient.cancelQueries({ queryKey: customerKeys.detail(identityKey, customerId) });
      queryClient.setQueryData(
        customerKeys.detail(identityKey, customerId),
        (current: typeof customerQuery.data) =>
          current === undefined ? current : { ...current, starred },
      );
      queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
    },
  });
  const businessOverviewQuery = useQuery({
    queryKey:
      customerId === null
        ? customerKeys.businessOverview(identityKey, 0)
        : customerKeys.businessOverview(identityKey, customerId),
    queryFn: () =>
      customerId === null || apiClient === null
        ? Promise.reject(new Error("Customer business overview is unavailable."))
        : apiClient.getCustomerBusinessOverview(customerId),
    enabled: apiClient !== null && customerId !== null,
  });
  const hierarchyQuery = useQuery({
    queryKey:
      customerId === null
        ? customerKeys.hierarchy(identityKey, 0)
        : customerKeys.hierarchy(identityKey, customerId),
    queryFn: () =>
      customerId === null || apiClient === null
        ? Promise.reject(new Error("Customer hierarchy is unavailable."))
        : apiClient.getCustomerHierarchy(customerId),
    enabled: apiClient !== null && customerId !== null,
  });
  const tagCatalogQuery = useQuery({
    queryKey: ["customer-tag-catalog", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer tag catalog is unavailable."))
        : apiClient.getCustomerTagCatalog(),
    enabled: apiClient !== null && tagEditorOpen && canWriteCustomers,
  });
  const memberQuery = useQuery({
    queryKey: ["member-selector", identityKey, memberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Member selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: memberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && ownerPickerOpen,
  });
  const ownerMutation = useMutation({
    mutationFn: ({ actorId, version }: { actorId: number; version: number }) =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer owner update is unavailable."))
        : apiClient.updateCustomerOwner(customerId, { ownerActorId: actorId, version }),
    onSuccess: (customer) => {
      queryClient.setQueryData(customerKeys.detail(identityKey, customer.id), customer);
      queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
      setOwnerPickerOpen(false);
      setMemberKeyword("");
    },
  });
  const collaboratorsQuery = useQuery({
    queryKey:
      customerId === null
        ? customerKeys.collaboratorBaseline(identityKey, 0)
        : customerKeys.collaboratorBaseline(identityKey, customerId),
    queryFn: () =>
      customerId === null || apiClient === null
        ? Promise.reject(new Error("Customer collaborators are unavailable."))
        : apiClient.getCustomerCollaboratorBaseline(customerId),
    enabled:
      apiClient !== null && customerId !== null && collaboratorPickerOpen && canManageCollaborators,
  });
  const collaboratorMemberQuery = useQuery({
    queryKey: [
      "member-selector",
      "customer-collaborators",
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
      collaborators: readonly CustomerCollaborator[];
      version: number;
    }) =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer collaborator update is unavailable."))
        : apiClient.replaceCustomerCollaborators(customerId, {
            collaborators: [...collaborators],
            version,
          }),
    onSuccess: (customer) => {
      queryClient.setQueryData(customerKeys.detail(identityKey, customer.id), customer);
      queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
      queryClient.invalidateQueries({
        queryKey: customerKeys.collaboratorBaseline(identityKey, customer.id),
      });
      setCollaboratorPickerOpen(false);
      setCollaboratorMemberKeyword("");
      setCollaboratorDraft(null);
    },
  });
  const exitCollaboratorMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer collaborator exit is unavailable."))
        : apiClient.exitCustomerCollaborator(customerId, version),
    onSuccess: () => {
      if (customerId === null) return;
      queryClient.removeQueries({ queryKey: customerKeys.detail(identityKey, customerId) });
      queryClient.removeQueries({
        queryKey: customerKeys.collaboratorBaseline(identityKey, customerId),
      });
      queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
      navigate("/crm/customers", { replace: true });
    },
  });
  const parentCandidateQuery = useQuery({
    queryKey: ["customer-parent-selector", identityKey, parentKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer parent selection is unavailable."))
        : apiClient.getCustomers({
            page: 1,
            size: 50,
            keyword: parentKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && parentPickerOpen,
  });
  const parentMutation = useMutation({
    mutationFn: ({ parentCustomerId, version }: { parentCustomerId?: number; version: number }) =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer parent update is unavailable."))
        : apiClient.updateCustomerParent(customerId, { parentCustomerId, version }),
    onSuccess: (customer) => {
      queryClient.setQueryData(customerKeys.detail(identityKey, customer.id), customer);
      queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
      queryClient.invalidateQueries({ queryKey: customerKeys.hierarchy(identityKey, customer.id) });
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
      dealStatus: CustomerDealStatus;
      version: number;
    }) =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer state update is unavailable."))
        : apiClient.updateCustomerState(customerId, { locked, dealStatus, version }),
    onSuccess: (customer) => {
      queryClient.setQueryData(customerKeys.detail(identityKey, customer.id), customer);
      queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
      setStatePickerOpen(false);
      setStateDraft(null);
    },
  });
  const tagMutation = useMutation({
    mutationFn: ({ tags, version }: { tags: readonly string[]; version: number }) =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer tag update is unavailable."))
        : apiClient.replaceCustomerTags(customerId, { tags: [...tags], version }),
    onSuccess: (customer) => {
      queryClient.setQueryData(customerKeys.detail(identityKey, customer.id), customer);
      queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
      queryClient.invalidateQueries({ queryKey: ["customer-tag-catalog", identityKey] });
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
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer custom-field update is unavailable."))
        : apiClient
            .updateCustomer(
              customerId,
              toCustomerCustomFieldUpdateRequest(customFieldDefinitions, {
                changedCodes,
                customFields: values,
                version,
              }),
            )
            .then((updatedCustomer) => {
              if (updatedCustomer.id !== customerId) {
                throw new Error("更新客户响应暂时不可用，请稍后重试。");
              }
              return updatedCustomer;
            }),
    onSuccess: (updatedCustomer) => {
      queryClient.setQueryData(
        customerKeys.detail(identityKey, updatedCustomer.id),
        updatedCustomer,
      );
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
      setChangedCustomFieldCodes(new Set());
      setCustomFieldErrors({});
      setCustomFieldValues({});
      setCustomFieldMemberKeyword("");
      setCustomFieldEditorOpen(false);
    },
  });
  const releasePoolCatalogQuery = useQuery({
    queryKey: customerPoolKeys.catalog(identityKey),
    queryFn: async () => {
      if (apiClient === null) throw new Error("Customer pool catalog API is unavailable.");
      return decodeCustomerPoolCatalog(await apiClient.getCustomerPoolCatalog());
    },
    enabled: apiClient !== null && releasePoolPickerOpen && canReadCustomerPools,
  });
  const releaseMutation = useMutation({
    mutationFn: ({ poolId, version }: { poolId: number; version: number }) =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer pool release is unavailable."))
        : apiClient.releaseCustomerToPool(poolId, {
            customers: [{ customerId, version }],
          }),
    onSuccess: (_, { poolId }) => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists(identityKey) });
      void queryClient.invalidateQueries({ queryKey: customerPoolKeys.all });
      setReleasePoolPickerOpen(false);
      navigate(`/crm/customer-pools/${poolId}`);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || customerId === null
        ? Promise.reject(new Error("Customer delete is unavailable."))
        : apiClient.deleteCustomer(customerId, version),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: customerKeys.all });
      navigate("/crm/customers", { replace: true });
    },
  });

  if (customerId === null) return <StatusPage kind="not-found" />;

  if (customerQuery.isLoading) {
    return (
      <div
        aria-label="正在加载客户详情"
        style={{ display: "grid", placeItems: "center", minHeight: 240 }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (customerQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(customerQuery.error)}
        onRetry={() => void customerQuery.refetch()}
      />
    );
  }

  const customer = customerQuery.data;
  if (customer === undefined) return <StatusPage kind="unavailable" />;

  const customerDynamicFields = serverProvidedDynamicFields(
    fieldDefinitionsQuery.data ?? [],
    customer.customFields,
  );
  const deleteConflict = getMutationConflict(deleteMutation.error);
  const collaboratorBaseline = collaboratorsQuery.data;
  const collaborators = collaboratorDraft ?? collaboratorBaseline?.collaborators ?? [];
  const collaboratorIds = new Set(collaborators.map((collaborator) => collaborator.actorId));
  const editableMemberOptions = (collaboratorMemberQuery.data ?? []).filter(
    (member) => member.actorId !== customer.ownerActorId && !collaboratorIds.has(member.actorId),
  );
  const hierarchyNames = new Map(
    (hierarchyQuery.data?.customers ?? []).map((hierarchyCustomer) => [
      hierarchyCustomer.id,
      hierarchyCustomer.name,
    ]),
  );
  const descendantIds = hierarchyQuery.data
    ? visibleDescendantIds(hierarchyQuery.data)
    : new Set<number>();
  const parentCandidates = parentCandidateQuery.data
    ? toPageResult(parentCandidateQuery.data, toCustomerListItem).items.filter(
        (candidate) => candidate.id !== customer.id && !descendantIds.has(candidate.id),
      )
    : [];
  const currentState =
    customer.locked !== null && isCustomerDealStatus(customer.dealStatus)
      ? { locked: customer.locked, dealStatus: customer.dealStatus }
      : null;
  const normalizedTagDraft = tagDraft === null ? null : normalizeCustomerTagDraft(tagDraft);
  const activeReleasePools = (releasePoolCatalogQuery.data ?? []).filter(
    (pool) => pool.status === "ACTIVE",
  );
  const editCollaborators = (
    edit: (current: readonly CustomerCollaborator[]) => readonly CustomerCollaborator[],
  ) => {
    setCollaboratorDraft((current) => {
      const source = current ?? collaboratorBaseline?.collaborators;
      return source === undefined ? current : edit(source);
    });
  };
  const closeCollaboratorPicker = () => {
    if (collaboratorMutation.isPending) return;
    collaboratorMutation.reset();
    setCollaboratorPickerOpen(false);
    setCollaboratorMemberKeyword("");
    setCollaboratorDraft(null);
  };
  const closeParentPicker = () => {
    if (parentMutation.isPending) return;
    parentMutation.reset();
    setParentPickerOpen(false);
    setParentKeyword("");
  };
  const closeStatePicker = () => {
    if (stateMutation.isPending) return;
    stateMutation.reset();
    setStatePickerOpen(false);
    setStateDraft(null);
  };
  const openTagEditor = () => {
    tagMutation.reset();
    setTagDraft(customer.tags);
    setTagEditorOpen(true);
  };
  const closeTagEditor = () => {
    if (tagMutation.isPending) return;
    tagMutation.reset();
    setTagEditorOpen(false);
    setTagDraft(null);
  };
  const closeCustomFieldEditor = () => {
    if (customFieldUpdateMutation.isPending) return;
    customFieldUpdateMutation.reset();
    setChangedCustomFieldCodes(new Set());
    setCustomFieldErrors({});
    setCustomFieldValues({});
    setCustomFieldMemberKeyword("");
    setCustomFieldEditorOpen(false);
  };
  const closeReleasePoolPicker = () => {
    if (releaseMutation.isPending) return;
    releaseMutation.reset();
    setReleasePoolPickerOpen(false);
  };
  const resolveDeleteConflict = async (resolution: MutationConflictResolution) => {
    if (resolution === "dismiss") {
      deleteMutation.reset();
      return;
    }

    await customerQuery.refetch();
    deleteMutation.reset();
  };
  const resolveTagConflict = async (resolution: MutationConflictResolution) => {
    if (resolution === "dismiss") {
      tagMutation.reset();
      return;
    }

    await customerQuery.refetch();
    if (resolution === "discard-draft-and-reload") setTagDraft(null);
    tagMutation.reset();
  };

  return (
    <RouteAuthority authority={authority.customersRead}>
      <main>
        <DetailWorkspace
          header={
            <section className={styles.heading}>
              <div>
                <Button
                  icon={<ArrowLeftOutlined />}
                  type="link"
                  onClick={onClose ?? (() => navigate("/crm/customers"))}
                >
                  返回客户列表
                </Button>
                <div className={styles.titleRow}>
                  <Typography.Title level={1}>{customer.name}</Typography.Title>
                  {customer.starred ? <StarFilled aria-label="已关注" /> : null}
                  {customer.locked ? (
                    <Tag icon={<LockOutlined />} color="orange">
                      已锁定
                    </Tag>
                  ) : null}
                  {customer.status ? <Tag>{customer.status}</Tag> : null}
                </div>
                <Typography.Text type="secondary">
                  基础字段以服务端响应为准；自定义字段需在取得有效字段访问上下文后显示。
                </Typography.Text>
                <Space className={styles.actions} size={[8, 8]} wrap>
                  <Button
                    icon={customer.starred ? <StarFilled /> : <StarOutlined />}
                    loading={starMutation.isPending}
                    onClick={() => starMutation.mutate(!customer.starred)}
                  >
                    {customer.starred ? "取消关注" : "关注"}
                  </Button>
                  <ApprovalStartAction
                    objectType="CUSTOMER"
                    subjectId={customer.id}
                    onStarted={() => {
                      void queryClient.invalidateQueries({
                        queryKey: customerKeys.detail(identityKey, customer.id),
                      });
                      void queryClient.invalidateQueries({
                        queryKey: customerKeys.lists(identityKey),
                      });
                    }}
                  />
                  <Button onClick={() => setStageWorkflowStartOpen(true)}>启动阶段工作流</Button>
                  <ActionAuthority authority={authority.customersWrite}>
                    <Button
                      type="primary"
                      onClick={() => navigate(`/crm/customers/${customer.id}/edit`)}
                    >
                      编辑基础信息
                    </Button>
                    <Button
                      onClick={() => {
                        parentMutation.reset();
                        setParentPickerOpen(true);
                      }}
                    >
                      设置上级客户
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
                  <ActionAuthority authority={authority.customersAssign}>
                    <ActionAuthority authority={authority.organizationRead}>
                      <Button onClick={() => setOwnerPickerOpen(true)}>变更负责人</Button>
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
                  <ActionAuthority authority={authority.customersWrite}>
                    <Popconfirm
                      cancelText="取消"
                      description="仅服务端确认当前成员为客户协作者时才会退出；负责人和其他成员不会由浏览器判断或修改。"
                      okButtonProps={{ danger: true }}
                      okText="确认退出"
                      title="确认退出该客户协作？"
                      onConfirm={() => exitCollaboratorMutation.mutate(customer.version)}
                    >
                      <Button danger loading={exitCollaboratorMutation.isPending}>
                        退出协作
                      </Button>
                    </Popconfirm>
                  </ActionAuthority>
                  {customer.status === "ACTIVE" ? (
                    <ActionAuthority authority={authority.customersWrite}>
                      <ActionAuthority authority={authority.customerPoolsRead}>
                        <ActionAuthority authority={authority.customerPoolsRelease}>
                          <Button
                            onClick={() => {
                              releaseMutation.reset();
                              setReleasePoolPickerOpen(true);
                            }}
                          >
                            移入客户公海
                          </Button>
                        </ActionAuthority>
                      </ActionAuthority>
                    </ActionAuthority>
                  ) : null}
                  <ActionAuthority authority={authority.returnVisitsRead}>
                    <Button onClick={() => navigate(`/crm/customers/${customer.id}/return-visits`)}>
                      查看回访
                    </Button>
                  </ActionAuthority>
                  <ActionAuthority authority={authority.contractsRead}>
                    <ActionAuthority authority={authority.customersRead}>
                      <Button onClick={() => navigate(`/crm/customers/${customer.id}/contracts`)}>
                        查看合同
                      </Button>
                    </ActionAuthority>
                  </ActionAuthority>
                  <ActionAuthority authority={authority.invoicesRead}>
                    <ActionAuthority authority={authority.customersRead}>
                      <Button
                        onClick={() => navigate(`/crm/customers/${customer.id}/invoice-profiles`)}
                      >
                        查看开票资料
                      </Button>
                      <Button onClick={() => navigate(`/crm/customers/${customer.id}/invoices`)}>
                        查看发票
                      </Button>
                    </ActionAuthority>
                  </ActionAuthority>
                  <ActionAuthority authority={authority.invoicesWrite}>
                    <ActionAuthority authority={authority.contractsRead}>
                      <ActionAuthority authority={authority.customersRead}>
                        <Button
                          onClick={() => navigate(`/crm/customers/${customer.id}/invoices/new`)}
                        >
                          新建发票
                        </Button>
                      </ActionAuthority>
                    </ActionAuthority>
                  </ActionAuthority>
                  <ActionAuthority authority={authority.receivablesRead}>
                    <ActionAuthority authority={authority.customersRead}>
                      <Button onClick={() => navigate(`/crm/customers/${customer.id}/receivables`)}>
                        查看回款
                      </Button>
                    </ActionAuthority>
                  </ActionAuthority>
                  <ActionAuthority authority={authority.receivablesWrite}>
                    <ActionAuthority authority={authority.contractsRead}>
                      <ActionAuthority authority={authority.customersRead}>
                        <Button
                          onClick={() => navigate(`/crm/customers/${customer.id}/receivables/new`)}
                        >
                          新建回款
                        </Button>
                      </ActionAuthority>
                    </ActionAuthority>
                  </ActionAuthority>
                  <ActionAuthority authority={authority.receivablePlansRead}>
                    <ActionAuthority authority={authority.customersRead}>
                      <Button
                        onClick={() => navigate(`/crm/customers/${customer.id}/receivable-plans`)}
                      >
                        查看回款计划
                      </Button>
                    </ActionAuthority>
                  </ActionAuthority>
                  <ActionAuthority authority={authority.receivablePlansWrite}>
                    <ActionAuthority authority={authority.contractsRead}>
                      <ActionAuthority authority={authority.customersRead}>
                        <Button
                          onClick={() =>
                            navigate(`/crm/customers/${customer.id}/receivable-plans/new`)
                          }
                        >
                          新建回款计划
                        </Button>
                      </ActionAuthority>
                    </ActionAuthority>
                  </ActionAuthority>
                  <ActionAuthority authority={authority.customersDelete}>
                    <Popconfirm
                      cancelText="取消"
                      description="删除后客户会进入服务端软删除状态，并由服务端撤回其附件与文件字段绑定。服务端会再次确认当前 version，且该客户没有活动下级客户。"
                      okButtonProps={{ danger: true }}
                      okText="确认删除"
                      title={`删除客户“${customer.name}”？`}
                      onConfirm={() => {
                        deleteMutation.reset();
                        deleteMutation.mutate(customer.version);
                      }}
                    >
                      <Button
                        danger
                        disabled={deleteMutation.isPending}
                        loading={deleteMutation.isPending}
                      >
                        删除客户
                      </Button>
                    </Popconfirm>
                  </ActionAuthority>
                </Space>
              </div>
            </section>
          }
          summary={
            <Card loading={businessOverviewQuery.isLoading} title="业务概览">
              {businessOverviewQuery.isError ? <CustomerBusinessOverviewUnavailable /> : null}
              {businessOverviewQuery.data ? (
                <CustomerBusinessOverviewCards overview={businessOverviewQuery.data} />
              ) : null}
            </Card>
          }
        >
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
          {ownerMutation.isError ? (
            <Alert
              title={
                ownerMutation.error instanceof ApiError
                  ? ownerMutation.error.message
                  : "客户负责人暂时无法更新"
              }
              showIcon
              type="error"
            />
          ) : null}
          {deleteMutation.isError && deleteConflict === null ? (
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
          {exitCollaboratorMutation.isError ? (
            <Alert
              title={
                exitCollaboratorMutation.error instanceof ApiError
                  ? exitCollaboratorMutation.error.message
                  : "暂时无法退出客户协作"
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

          <Tabs
            activeKey={activeDetailTab}
            className={styles.detailTabs}
            items={[
              { key: "activity", label: "活动" },
              { key: "details", label: "详细资料" },
              { key: "relations", label: "关联信息" },
            ]}
            onChange={setActiveDetailTab}
          />
          {activeDetailTab === "details" ? (
            <>
              <Card title="基本信息">
                <Descriptions
                  column={{ xs: 1, sm: 2, lg: 3 }}
                  items={[
                    { key: "id", label: "客户编号", children: customer.id },
                    {
                      key: "owner",
                      label: "负责人",
                      children: displayValue(customer.ownerActorId),
                    },
                    {
                      key: "parent",
                      label: "上级客户",
                      children: displayValue(customer.parentCustomerId),
                    },
                    {
                      key: "phone",
                      label: "联系电话",
                      children: displayValue(customer.phoneNumber),
                    },
                    { key: "telephone", label: "座机", children: displayValue(customer.telephone) },
                    { key: "email", label: "邮箱", children: displayValue(customer.email) },
                    { key: "website", label: "网站", children: displayValue(customer.website) },
                    { key: "deal", label: "成交状态", children: displayValue(customer.dealStatus) },
                    {
                      key: "created",
                      label: "创建时间",
                      children: displayValue(customer.createdTime),
                    },
                    {
                      key: "updated",
                      label: "更新时间",
                      children: displayValue(customer.updatedTime),
                    },
                  ]}
                />
              </Card>

              <Card loading={hierarchyQuery.isLoading} title="客户层级">
                {hierarchyQuery.isError ? (
                  <Alert title="客户层级暂时无法加载" showIcon type="error" />
                ) : null}
                {hierarchyQuery.data ? (
                  <List
                    dataSource={[...hierarchyQuery.data.customers]}
                    locale={{ emptyText: "暂无可见层级关系" }}
                    renderItem={(hierarchyCustomer) => {
                      const parentName =
                        hierarchyCustomer.parentCustomerId === null
                          ? null
                          : hierarchyNames.get(hierarchyCustomer.parentCustomerId);
                      return (
                        <List.Item>
                          <List.Item.Meta
                            description={
                              hierarchyCustomer.parentCustomerId === null
                                ? "无上级客户"
                                : parentName
                                  ? `上级客户：${parentName}`
                                  : `上级客户：${hierarchyCustomer.parentCustomerId}`
                            }
                            title={
                              hierarchyCustomer.id === customer.id
                                ? `${hierarchyCustomer.name}（当前客户）`
                                : hierarchyCustomer.name
                            }
                          />
                        </List.Item>
                      );
                    }}
                  />
                ) : null}
              </Card>

              <Card
                extra={
                  <ActionAuthority authority={authority.customersWrite}>
                    <Button onClick={openTagEditor}>管理标签</Button>
                  </ActionAuthority>
                }
                title="标签"
              >
                {customer.tags.length === 0 ? (
                  <Typography.Text type="secondary">暂无标签</Typography.Text>
                ) : (
                  <div className={styles.tags}>
                    {customer.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="地址">
                {(customer.addresses ?? []).length === 0 ? (
                  <Typography.Text type="secondary">暂无可见地址</Typography.Text>
                ) : (
                  <List
                    dataSource={[...(customer.addresses ?? [])]}
                    locale={{ emptyText: "暂无可见地址" }}
                    renderItem={(address) => {
                      const location = [
                        address.country,
                        address.region,
                        address.city,
                        address.postalCode,
                      ].filter((value): value is string => value !== null);
                      return (
                        <List.Item
                          extra={address.primary ? <Tag color="blue">主要地址</Tag> : null}
                        >
                          <List.Item.Meta
                            description={location.length > 0 ? location.join(" · ") : undefined}
                            title={address.label ?? address.addressLine}
                          />
                          {address.label === null ? null : (
                            <Typography.Text>{address.addressLine}</Typography.Text>
                          )}
                        </List.Item>
                      );
                    }}
                  />
                )}
              </Card>

              <ControlledFileFieldDownloadCard
                canRead={canReadCustomerFileFields}
                fileFields={customer.fileFields ?? []}
                targetId={customer.id}
                targetType="customer"
                title="客户字段附件"
              />

              <EmbeddedPagePanel objectType="CUSTOMER" platform="WEB" recordId={customer.id} />
            </>
          ) : null}

          {activeDetailTab === "activity" ? (
            <ActivityTimelineCard subjectId={customer.id} subjectType="CUSTOMER" />
          ) : null}

          {activeDetailTab === "relations" ? (
            <Card title="关联信息">
              <Descriptions
                column={{ xs: 1, sm: 2 }}
                items={[
                  { key: "owner", label: "负责人", children: displayValue(customer.ownerActorId) },
                  {
                    key: "parent",
                    label: "上级客户",
                    children: displayValue(customer.parentCustomerId),
                  },
                  {
                    key: "tagCount",
                    label: "客户标签",
                    children: customer.tags.length === 0 ? "暂无标签" : customer.tags.join("、"),
                  },
                ]}
              />
            </Card>
          ) : null}

          {activeDetailTab === "details" ? (
            <>
              <Card title="说明">
                <Typography.Paragraph className={styles.description}>
                  {customer.description ?? "暂无说明"}
                </Typography.Paragraph>
              </Card>
              {canReadFieldMetadata && fieldDefinitionsQuery.isLoading ? (
                <Card title="自定义字段">
                  <Spin aria-label="正在加载客户自定义字段目录" />
                </Card>
              ) : null}
              {canReadFieldMetadata && fieldDefinitionsQuery.isError ? (
                <Card title="自定义字段">
                  <Alert title="客户自定义字段目录暂时无法加载" showIcon type="error" />
                </Card>
              ) : null}
              {customerDynamicFields.length > 0 || customFormFieldDefinitions.length > 0 ? (
                <Card
                  extra={
                    canWriteCustomers && customFormFieldDefinitions.length > 0 ? (
                      <ActionAuthority authority={authority.customersWrite}>
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
                  {customerDynamicFields.length > 0 ? (
                    <ServerProvidedDynamicFieldDescriptions
                      columns={{ sm: 1, xs: 1 }}
                      definitions={customFieldDefinitions}
                      values={customer.customFields}
                    />
                  ) : (
                    <Typography.Text type="secondary">暂无可见字段值</Typography.Text>
                  )}
                </Card>
              ) : null}
            </>
          ) : null}
        </DetailWorkspace>
      </main>
      <StageWorkflowStartModal
        objectType="CUSTOMER"
        open={stageWorkflowStartOpen}
        recordId={customer.id}
        onClose={() => setStageWorkflowStartOpen(false)}
        onStarted={(workflowRecordId) => {
          setStageWorkflowStartOpen(false);
          navigate(`/workflow-records/${workflowRecordId}`);
        }}
      />
      <Modal
        destroyOnHidden
        footer={null}
        open={releasePoolPickerOpen}
        title="移入客户公海"
        onCancel={closeReleasePoolPicker}
      >
        <Typography.Paragraph type="secondary">
          仅列出服务端确认当前成员可访问的启用公海。提交会携带当前客户
          version，客户写入范围、公海资格与并发状态均由服务端再次校验。
        </Typography.Paragraph>
        {releasePoolCatalogQuery.isError ? (
          <Alert title="客户公海目录暂时无法加载" showIcon type="error" />
        ) : (
          <List
            dataSource={activeReleasePools}
            loading={releasePoolCatalogQuery.isLoading}
            locale={{ emptyText: "暂无可移入的客户公海" }}
            renderItem={(pool) => (
              <List.Item
                actions={[
                  <Button
                    disabled={releaseMutation.isPending}
                    key={pool.id}
                    loading={releaseMutation.isPending}
                    type="link"
                    onClick={() =>
                      releaseMutation.mutate({ poolId: pool.id, version: customer.version })
                    }
                  >
                    移入此公海
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  description={`服务端当前统计：${pool.customerCount} 位客户`}
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
                : "客户暂时无法移入公海"
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
                  version: customer.version,
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
          <Alert title="客户自定义字段目录暂时无法加载" showIcon type="warning" />
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
                : "客户自定义字段暂时无法更新"
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
          if (!ownerMutation.isPending) setOwnerPickerOpen(false);
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
                    disabled={ownerMutation.isPending || member.actorId === customer.ownerActorId}
                    key={member.actorId}
                    loading={ownerMutation.isPending}
                    type="link"
                    onClick={() =>
                      ownerMutation.mutate({ actorId: member.actorId, version: customer.version })
                    }
                  >
                    {member.actorId === customer.ownerActorId ? "当前负责人" : "选择"}
                  </Button>,
                ]}
              >
                <List.Item.Meta description={`成员 ${member.actorId}`} title={member.displayName} />
              </List.Item>
            )}
          />
        )}
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
                tagMutation.mutate({ tags: normalizedTagDraft, version: customer.version });
              }}
            >
              保存标签
            </Button>
          </>
        }
        open={tagEditorOpen}
        title="管理客户标签"
        onCancel={closeTagEditor}
      >
        <Typography.Paragraph type="secondary">
          先由服务端确认标签字段可读且未遮罩，再按当前详情的原始 version
          整体替换。可从已知标签选择或输入新标签；最终字段权限、数据范围与并发由服务端复核。
        </Typography.Paragraph>
        {tagCatalogQuery.isError ? (
          <Alert title="客户标签目录暂时无法加载，无法安全保存" showIcon type="error" />
        ) : (
          <Select
            aria-label="客户标签"
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
                : "客户标签暂时无法更新"
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
          <Alert title="客户协作者暂时无法加载" showIcon type="error" />
        ) : (
          <List
            dataSource={[...collaborators]}
            loading={collaboratorsQuery.isLoading}
            locale={{ emptyText: "暂无协作者" }}
            renderItem={(collaborator) => (
              <List.Item
                actions={[
                  <Select<CustomerCollaboratorAccess>
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
                : "客户协作者暂时无法更新"
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
        title="设置上级客户"
        onCancel={closeParentPicker}
      >
        <Typography.Paragraph type="secondary">
          候选客户与层级关系均来自服务端可见范围。服务端会拒绝循环层级和超出容量的调整。
        </Typography.Paragraph>
        {customer.parentCustomerId !== null ? (
          <Popconfirm
            cancelText="取消"
            okText="清除"
            title="确认清除当前上级客户吗？"
            onConfirm={() => parentMutation.mutate({ version: customer.version })}
          >
            <Button danger disabled={parentMutation.isPending} style={{ marginBottom: 12 }}>
              清除当前上级（
              {hierarchyNames.get(customer.parentCustomerId) ?? customer.parentCustomerId}）
            </Button>
          </Popconfirm>
        ) : null}
        <Input.Search
          allowClear
          defaultValue={parentKeyword}
          placeholder="搜索可见客户"
          onSearch={(keyword) => setParentKeyword(keyword)}
        />
        {parentCandidateQuery.isError ? (
          <Alert title="客户候选列表暂时无法加载" showIcon style={{ marginTop: 12 }} type="error" />
        ) : (
          <List
            dataSource={parentCandidates}
            loading={parentCandidateQuery.isLoading}
            locale={{ emptyText: "未找到可设置为上级的客户" }}
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
                        parentCustomerId: candidate.id,
                        version: customer.version,
                      })
                    }
                  >
                    设为上级
                  </Button>,
                ]}
              >
                <List.Item.Meta description={`客户 ${candidate.id}`} title={candidate.name} />
              </List.Item>
            )}
          />
        )}
        {parentMutation.isError ? (
          <Alert
            title={
              parentMutation.error instanceof ApiError
                ? parentMutation.error.message
                : "客户上级暂时无法更新"
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
                  : stateMutation.mutate({ ...stateDraft, version: customer.version })
              }
            >
              保存状态
            </Button>
          </>
        }
        open={statePickerOpen}
        title="修改客户状态"
        onCancel={closeStatePicker}
      >
        <Typography.Paragraph type="secondary">
          锁定和成交状态由服务端一起校验并更新，保存时会使用当前详情版本。
        </Typography.Paragraph>
        {stateDraft ? (
          <>
            <Typography.Paragraph>
              锁定客户{" "}
              <Switch
                checked={stateDraft.locked}
                onChange={(locked) => setStateDraft({ ...stateDraft, locked })}
              />
            </Typography.Paragraph>
            <Select<CustomerDealStatus>
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
                : "客户状态暂时无法更新"
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
