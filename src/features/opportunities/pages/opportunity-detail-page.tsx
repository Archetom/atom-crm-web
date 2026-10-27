import { ArrowLeftOutlined, StarFilled, StarOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
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
  createFieldMetadataQueryKeys,
  serverProvidedDynamicFields,
  ServerProvidedDynamicFieldDescriptions,
} from "~/components/dynamic-field";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";
import {
  MutationConflictNotice,
  type MutationConflictResolution,
} from "~/components/feedback/mutation-conflict-notice";
import { ActivityTimelineCard } from "~/features/activities";
import { ApprovalStartAction } from "~/features/approvals";
import { toContactListItem } from "~/features/contacts";
import { toProductListItem } from "~/features/products";
import { formatServerAmount } from "~/shared/utils/format-server-amount";

import {
  type OpportunityCollaborator,
  type OpportunityCollaboratorAccess,
} from "../model/opportunity-collaborator";
import type { OpportunityContact } from "../model/opportunity-contact";
import type { OpportunityProductBaselineLine } from "../model/opportunity-product-baseline";
import {
  opportunityCollaboratorBaselineKey,
  opportunityContactsBaselineKey,
  opportunityKeys,
  opportunityProductBaselineKey,
} from "../model/query-keys";

import styles from "./opportunity-detail-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

function displayValue(value: number | string | null): string {
  return value === null ? "—" : String(value);
}

type OpportunityOutcome = "OPEN" | "WON" | "LOST" | "INVALID";
type PrimaryContactSelection = number | "clear";

type OpportunityProductDraftLine = Omit<OpportunityProductBaselineLine, "unitPrice"> & {
  unitPrice?: number;
};

const outcomeOptions: { label: string; value: OpportunityOutcome }[] = [
  { label: "跟进中", value: "OPEN" },
  { label: "赢单", value: "WON" },
  { label: "输单", value: "LOST" },
  { label: "无效", value: "INVALID" },
];

const maximumOpportunityProductInput = Number.MAX_SAFE_INTEGER;

function isOpportunityOutcome(value: string | null): value is OpportunityOutcome {
  return outcomeOptions.some((option) => option.value === value);
}

export function OpportunityDetailPage() {
  const { opportunityId: opportunityIdParam } = useParams();
  return <OpportunityDetailSurface opportunityId={parseRouteId(opportunityIdParam)} />;
}

export function OpportunityDetailSurface({
  opportunityId,
  onClose,
}: Readonly<{
  opportunityId: number | null;
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
    navigate("/crm/opportunities", { replace: true });
  }
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [targetStageCode, setTargetStageCode] = useState<string>();
  const [outcomePickerOpen, setOutcomePickerOpen] = useState(false);
  const [targetOutcome, setTargetOutcome] = useState<OpportunityOutcome>("OPEN");
  const [outcomeRemark, setOutcomeRemark] = useState("");
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [ownerMemberKeyword, setOwnerMemberKeyword] = useState("");
  const [collaboratorPickerOpen, setCollaboratorPickerOpen] = useState(false);
  const [collaboratorMemberKeyword, setCollaboratorMemberKeyword] = useState("");
  const [collaboratorDraft, setCollaboratorDraft] = useState<
    readonly OpportunityCollaborator[] | null
  >(null);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactKeyword, setContactKeyword] = useState("");
  const [contactDraft, setContactDraft] = useState<readonly OpportunityContact[] | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productKeyword, setProductKeyword] = useState("");
  const [productDraft, setProductDraft] = useState<readonly OpportunityProductDraftLine[] | null>(
    null,
  );
  const [primaryContactPickerOpen, setPrimaryContactPickerOpen] = useState(false);
  const [targetPrimaryContactId, setTargetPrimaryContactId] =
    useState<PrimaryContactSelection>("clear");
  const canReadPipelines = hasAuthority(authorization, authority.opportunityPipelinesRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canReadContacts = hasAuthority(authorization, authority.contactsRead);
  const canReadProducts = hasAuthority(authorization, authority.productsRead);
  const canReadFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canWriteOpportunities = hasAuthority(authorization, authority.opportunitiesWrite);
  const canReadFileFields =
    hasAuthority(authorization, authority.opportunitiesRead) &&
    hasAuthority(authorization, authority.filesRead);
  const canManageCollaborators = hasAuthority(authorization, authority.opportunitiesAssign);
  const opportunityQuery = useQuery({
    queryKey:
      opportunityId === null
        ? opportunityKeys.detail(identityKey, 0)
        : opportunityKeys.detail(identityKey, opportunityId),
    queryFn: () =>
      opportunityId === null || apiClient === null
        ? Promise.reject(new Error("Opportunity detail is unavailable."))
        : apiClient.getOpportunity(opportunityId),
    enabled: apiClient !== null && opportunityId !== null,
  });
  const fieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "OPPORTUNITY", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity field definitions are unavailable."))
        : apiClient.getFieldDefinitions("OPPORTUNITY"),
    enabled: apiClient !== null && opportunityId !== null && canReadFieldMetadata,
  });
  const contactsQuery = useQuery({
    queryKey:
      opportunityId === null
        ? (["opportunity-contacts", identityKey, 0] as const)
        : (["opportunity-contacts", identityKey, opportunityId] as const),
    queryFn: () =>
      apiClient === null || opportunityId === null
        ? Promise.reject(new Error("Opportunity contacts are unavailable."))
        : apiClient.getOpportunityContacts(opportunityId),
    enabled: apiClient !== null && opportunityId !== null && canReadContacts,
  });
  const productsQuery = useQuery({
    queryKey:
      opportunityId === null
        ? (["opportunity-products", identityKey, 0] as const)
        : (["opportunity-products", identityKey, opportunityId] as const),
    queryFn: () =>
      apiClient === null || opportunityId === null
        ? Promise.reject(new Error("Opportunity products are unavailable."))
        : apiClient.getOpportunityProducts(opportunityId),
    enabled: apiClient !== null && opportunityId !== null && canReadProducts,
  });
  const productsBaselineQuery = useQuery({
    queryKey:
      opportunityId === null
        ? opportunityProductBaselineKey(identityKey, 0)
        : opportunityProductBaselineKey(identityKey, opportunityId),
    queryFn: () =>
      apiClient === null || opportunityId === null
        ? Promise.reject(new Error("Opportunity product baseline is unavailable."))
        : apiClient.getOpportunityProductBaseline(opportunityId),
    enabled:
      apiClient !== null &&
      opportunityId !== null &&
      productPickerOpen &&
      canReadProducts &&
      canWriteOpportunities,
  });
  const productCandidateQuery = useQuery({
    queryKey: ["opportunity-product-replacement-selector", identityKey, productKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity product selection is unavailable."))
        : apiClient.getProducts({
            availability: "AVAILABLE",
            keyword: productKeyword.trim() || undefined,
            page: 1,
            size: 100,
          }),
    enabled: apiClient !== null && productPickerOpen && canReadProducts && canWriteOpportunities,
  });
  const currentPipelineCode = opportunityQuery.data?.pipelineCode;
  const pipelineQuery = useQuery({
    queryKey: ["opportunity-stage-pipeline-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Opportunity pipeline selection is unavailable."))
        : apiClient.getOpportunityPipelines({ page: 1, size: 100, status: "ACTIVE" }),
    enabled: apiClient !== null && stagePickerOpen && canReadPipelines,
  });
  const currentPipeline = pipelineQuery.data?.find(
    (pipeline) => pipeline.code === currentPipelineCode,
  );
  const stageQuery = useQuery({
    queryKey:
      currentPipeline === undefined
        ? (["opportunity-stage-selector", identityKey, 0] as const)
        : (["opportunity-stage-selector", identityKey, currentPipeline.id] as const),
    queryFn: () =>
      apiClient === null || currentPipeline === undefined
        ? Promise.reject(new Error("Opportunity stage selection is unavailable."))
        : apiClient.getOpportunityPipelineStages(currentPipeline.id, {
            page: 1,
            size: 100,
            status: "ACTIVE",
          }),
    enabled: apiClient !== null && stagePickerOpen && currentPipeline !== undefined,
  });
  const targetStageIsActive =
    targetStageCode !== undefined &&
    stageQuery.data?.some((stage) => stage.code === targetStageCode) === true;
  const ownerMemberQuery = useQuery({
    queryKey: ["member-selector", "opportunity-owner", identityKey, ownerMemberKeyword] as const,
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
  const collaboratorsQuery = useQuery({
    queryKey:
      opportunityId === null
        ? opportunityCollaboratorBaselineKey(identityKey, 0)
        : opportunityCollaboratorBaselineKey(identityKey, opportunityId),
    queryFn: () =>
      apiClient === null || opportunityId === null
        ? Promise.reject(new Error("Opportunity collaborators are unavailable."))
        : apiClient.getOpportunityCollaboratorBaseline(opportunityId),
    enabled:
      apiClient !== null &&
      opportunityId !== null &&
      collaboratorPickerOpen &&
      canManageCollaborators,
  });
  const contactsBaselineQuery = useQuery({
    queryKey:
      opportunityId === null
        ? opportunityContactsBaselineKey(identityKey, 0)
        : opportunityContactsBaselineKey(identityKey, opportunityId),
    queryFn: () =>
      apiClient === null || opportunityId === null
        ? Promise.reject(new Error("Opportunity contacts baseline is unavailable."))
        : apiClient.getOpportunityContactsBaseline(opportunityId),
    enabled:
      apiClient !== null &&
      opportunityId !== null &&
      contactPickerOpen &&
      canReadContacts &&
      canWriteOpportunities,
  });
  const contactCandidateQuery = useQuery({
    queryKey: [
      "opportunity-contact-replacement-selector",
      identityKey,
      contactsBaselineQuery.data?.editable ? contactsBaselineQuery.data.customerId : 0,
      contactKeyword,
    ] as const,
    queryFn: () => {
      const customerId = contactsBaselineQuery.data?.customerId;
      if (apiClient === null || customerId === null || customerId === undefined) {
        return Promise.reject(new Error("Opportunity contact selection is unavailable."));
      }
      return apiClient
        .getContacts({
          customerId,
          keyword: contactKeyword.trim() || undefined,
          page: 1,
          size: 100,
        })
        .then((pager) =>
          toPageResult(pager, toContactListItem).items.flatMap((contact) =>
            contact.customerId === customerId && contact.id > 0
              ? [{ id: contact.id, name: contact.name }]
              : [],
          ),
        );
    },
    enabled:
      apiClient !== null &&
      contactPickerOpen &&
      contactsBaselineQuery.data?.editable === true &&
      contactsBaselineQuery.data.customerId !== null &&
      contactsBaselineQuery.data.customerId !== undefined,
  });
  const collaboratorMemberQuery = useQuery({
    queryKey: [
      "member-selector",
      "opportunity-collaborators",
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
    enabled:
      apiClient !== null && collaboratorPickerOpen && canManageCollaborators && canReadOrganization,
  });
  const starMutation = useMutation({
    mutationFn: (starred: boolean) =>
      apiClient === null || opportunityId === null
        ? Promise.reject(new Error("Opportunity star is unavailable."))
        : apiClient.setOpportunityStarred(opportunityId, { starred }),
    onSuccess: async (_, starred) => {
      if (opportunityId === null) return;
      await queryClient.cancelQueries({
        queryKey: opportunityKeys.detail(identityKey, opportunityId),
      });
      queryClient.setQueryData(
        opportunityKeys.detail(identityKey, opportunityId),
        (current: typeof opportunityQuery.data) =>
          current === undefined ? current : { ...current, starred },
      );
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists(identityKey) });
    },
  });
  const stageMutation = useMutation({
    mutationFn: (stageCode: string) => {
      const opportunity = opportunityQuery.data;
      if (
        apiClient === null ||
        opportunityId === null ||
        opportunity === undefined ||
        currentPipeline === undefined ||
        !stageQuery.data?.some((stage) => stage.code === stageCode)
      ) {
        return Promise.reject(new Error("Opportunity stage update is unavailable."));
      }
      return apiClient.updateOpportunityStage(opportunityId, {
        pipelineCode: currentPipeline.code,
        stageCode,
        version: opportunity.version,
      });
    },
    onSuccess: (opportunity) => {
      if (opportunityId === null) return;
      queryClient.setQueryData(opportunityKeys.detail(identityKey, opportunityId), opportunity);
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists(identityKey) });
      setStagePickerOpen(false);
      setTargetStageCode(undefined);
    },
  });
  const outcomeMutation = useMutation({
    mutationFn: ({ outcome, remark }: { outcome: OpportunityOutcome; remark: string }) => {
      const opportunity = opportunityQuery.data;
      if (apiClient === null || opportunityId === null || opportunity === undefined) {
        return Promise.reject(new Error("Opportunity outcome update is unavailable."));
      }
      return apiClient.updateOpportunityOutcome(opportunityId, {
        outcome,
        ...(outcome === "OPEN" ? {} : { remark: remark.trim() || undefined }),
        version: opportunity.version,
      });
    },
    onSuccess: (opportunity) => {
      if (opportunityId === null) return;
      queryClient.setQueryData(opportunityKeys.detail(identityKey, opportunityId), opportunity);
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists(identityKey) });
      setOutcomePickerOpen(false);
      setOutcomeRemark("");
    },
  });
  const ownerMutation = useMutation({
    mutationFn: ({ actorId, version }: { actorId: number; version: number }) =>
      apiClient === null || opportunityId === null
        ? Promise.reject(new Error("Opportunity owner update is unavailable."))
        : apiClient.updateOpportunityOwner(opportunityId, { ownerActorId: actorId, version }),
    onSuccess: (opportunity) => {
      queryClient.setQueryData(opportunityKeys.detail(identityKey, opportunity.id), opportunity);
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists(identityKey) });
      setOwnerPickerOpen(false);
      setOwnerMemberKeyword("");
    },
  });
  const collaboratorMutation = useMutation({
    mutationFn: ({
      collaborators,
      version,
    }: {
      collaborators: readonly OpportunityCollaborator[];
      version: number;
    }) =>
      apiClient === null || opportunityId === null
        ? Promise.reject(new Error("Opportunity collaborator update is unavailable."))
        : apiClient.replaceOpportunityCollaborators(opportunityId, {
            collaborators: [...collaborators],
            version,
          }),
    onSuccess: (updatedOpportunity) => {
      queryClient.setQueryData(
        opportunityKeys.detail(identityKey, updatedOpportunity.id),
        updatedOpportunity,
      );
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists(identityKey) });
      queryClient.invalidateQueries({
        queryKey: opportunityCollaboratorBaselineKey(identityKey, updatedOpportunity.id),
      });
      setCollaboratorPickerOpen(false);
      setCollaboratorMemberKeyword("");
      setCollaboratorDraft(null);
    },
  });
  const exitCollaboratorMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || opportunityId === null
        ? Promise.reject(new Error("Opportunity collaborator exit is unavailable."))
        : apiClient.exitOpportunityCollaborator(opportunityId, version),
    onSuccess: () => {
      if (opportunityId === null) return;
      queryClient.removeQueries({ queryKey: opportunityKeys.detail(identityKey, opportunityId) });
      queryClient.removeQueries({
        queryKey: opportunityCollaboratorBaselineKey(identityKey, opportunityId),
      });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists(identityKey) });
      closeDetail();
    },
  });
  const primaryContactMutation = useMutation({
    mutationFn: (contactId: number | null) => {
      const opportunity = opportunityQuery.data;
      if (apiClient === null || opportunityId === null || opportunity === undefined) {
        return Promise.reject(new Error("Opportunity primary contact update is unavailable."));
      }
      return apiClient.updateOpportunityPrimaryContact(opportunityId, {
        ...(contactId === null ? {} : { contactId }),
        version: opportunity.version,
      });
    },
    onSuccess: async (opportunity) => {
      queryClient.setQueryData(opportunityKeys.detail(identityKey, opportunity.id), opportunity);
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists(identityKey) });
      if (opportunityId !== null) {
        await queryClient.invalidateQueries({
          queryKey: ["opportunity-contacts", identityKey, opportunityId],
        });
        await queryClient.invalidateQueries({
          queryKey: opportunityContactsBaselineKey(identityKey, opportunityId),
        });
      }
      setPrimaryContactPickerOpen(false);
      setTargetPrimaryContactId("clear");
    },
  });
  const contactMutation = useMutation({
    mutationFn: ({
      contacts,
      version,
    }: {
      contacts: readonly OpportunityContact[];
      version: number;
    }) => {
      const primaryContact = contacts.find((contact) => contact.primary);
      return apiClient === null || opportunityId === null
        ? Promise.reject(new Error("Opportunity contacts update is unavailable."))
        : apiClient.replaceOpportunityContacts(opportunityId, {
            contactIds: contacts.map((contact) => contact.id),
            ...(primaryContact === undefined ? {} : { primaryContactId: primaryContact.id }),
            version,
          });
    },
    onSuccess: async (updatedOpportunity) => {
      queryClient.setQueryData(
        opportunityKeys.detail(identityKey, updatedOpportunity.id),
        updatedOpportunity,
      );
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists(identityKey) });
      await queryClient.invalidateQueries({
        queryKey: ["opportunity-contacts", identityKey, updatedOpportunity.id],
      });
      await queryClient.invalidateQueries({
        queryKey: opportunityContactsBaselineKey(identityKey, updatedOpportunity.id),
      });
      setContactPickerOpen(false);
      setContactKeyword("");
      setContactDraft(null);
    },
  });
  const productMutation = useMutation({
    mutationFn: ({
      lines,
      version,
    }: {
      lines: readonly OpportunityProductDraftLine[];
      version: number;
    }) =>
      apiClient === null || opportunityId === null
        ? Promise.reject(new Error("Opportunity products update is unavailable."))
        : apiClient.replaceOpportunityProducts(opportunityId, {
            lines: lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              ...(line.unitPrice === undefined ? {} : { unitPrice: line.unitPrice }),
            })),
            version,
          }),
    onSuccess: async (baseline) => {
      queryClient.setQueryData(
        opportunityProductBaselineKey(identityKey, baseline.opportunityId),
        baseline,
      );
      await queryClient.invalidateQueries({
        queryKey: ["opportunity-products", identityKey, baseline.opportunityId],
      });
      await queryClient.invalidateQueries({
        queryKey: opportunityKeys.detail(identityKey, baseline.opportunityId),
      });
      await queryClient.invalidateQueries({ queryKey: opportunityKeys.lists(identityKey) });
      setProductPickerOpen(false);
      setProductKeyword("");
      setProductDraft(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || opportunityId === null
        ? Promise.reject(new Error("Opportunity delete is unavailable."))
        : apiClient.deleteOpportunity(opportunityId, version),
    onSuccess: () => {
      if (opportunityId === null) return;
      queryClient.removeQueries({ queryKey: opportunityKeys.detail(identityKey, opportunityId) });
      queryClient.removeQueries({
        queryKey: ["opportunity-contacts", identityKey, opportunityId],
      });
      queryClient.removeQueries({
        queryKey: opportunityContactsBaselineKey(identityKey, opportunityId),
      });
      queryClient.removeQueries({
        queryKey: ["opportunity-products", identityKey, opportunityId],
      });
      queryClient.removeQueries({
        queryKey: opportunityProductBaselineKey(identityKey, opportunityId),
      });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists(identityKey) });
      closeDetail();
    },
  });

  function closeOwnerPicker() {
    if (ownerMutation.isPending) return;
    ownerMutation.reset();
    setOwnerPickerOpen(false);
    setOwnerMemberKeyword("");
  }

  function closeCollaboratorPicker() {
    if (collaboratorMutation.isPending) return;
    collaboratorMutation.reset();
    setCollaboratorPickerOpen(false);
    setCollaboratorMemberKeyword("");
    setCollaboratorDraft(null);
  }

  function closePrimaryContactPicker() {
    if (primaryContactMutation.isPending) return;
    primaryContactMutation.reset();
    setPrimaryContactPickerOpen(false);
    setTargetPrimaryContactId("clear");
  }

  function closeContactPicker() {
    if (contactMutation.isPending) return;
    contactMutation.reset();
    setContactPickerOpen(false);
    setContactKeyword("");
    setContactDraft(null);
  }

  function closeProductPicker() {
    if (productMutation.isPending) return;
    productMutation.reset();
    setProductPickerOpen(false);
    setProductKeyword("");
    setProductDraft(null);
  }

  if (opportunityId === null) return <StatusPage kind="not-found" />;

  if (opportunityQuery.isLoading) {
    return (
      <div
        aria-label="正在加载商机详情"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (opportunityQuery.isError) {
    return (
      <StatusPage
        kind={statusKindFromError(opportunityQuery.error)}
        onRetry={() => void opportunityQuery.refetch()}
      />
    );
  }

  const opportunity = opportunityQuery.data;
  if (opportunity === undefined) return <StatusPage kind="unavailable" />;
  const opportunityDynamicFields = serverProvidedDynamicFields(
    fieldDefinitionsQuery.data ?? [],
    opportunity.customFields,
  );
  const deleteConflict = getMutationConflict(deleteMutation.error);
  const collaborators = collaboratorDraft ?? collaboratorsQuery.data?.collaborators ?? [];
  const collaboratorIds = new Set(collaborators.map((collaborator) => collaborator.actorId));
  const editableMemberOptions = (collaboratorMemberQuery.data ?? []).filter(
    (member) => member.actorId !== opportunity.ownerActorId && !collaboratorIds.has(member.actorId),
  );
  const replacementContacts = contactDraft ?? contactsBaselineQuery.data?.contacts ?? [];
  const replacementContactIds = new Set(replacementContacts.map((contact) => contact.id));
  const editableContactOptions = (contactCandidateQuery.data ?? []).filter(
    (contact) => !replacementContactIds.has(contact.id),
  );
  const replacementProducts = productDraft ?? productsBaselineQuery.data?.lines ?? [];
  const replacementProductIds = new Set(replacementProducts.map((product) => product.productId));
  const editableProductOptions = productCandidateQuery.data
    ? toPageResult(productCandidateQuery.data, toProductListItem).items.filter(
        (product) => !replacementProductIds.has(product.id),
      )
    : [];

  function editCollaborators(
    edit: (current: readonly OpportunityCollaborator[]) => readonly OpportunityCollaborator[],
  ) {
    setCollaboratorDraft((current) =>
      edit(current ?? collaboratorsQuery.data?.collaborators ?? []),
    );
  }

  function editOpportunityContacts(
    edit: (current: readonly OpportunityContact[]) => readonly OpportunityContact[],
  ) {
    setContactDraft((current) => edit(current ?? contactsBaselineQuery.data?.contacts ?? []));
  }

  function editOpportunityProducts(
    edit: (
      current: readonly OpportunityProductDraftLine[],
    ) => readonly OpportunityProductDraftLine[],
  ) {
    setProductDraft((current) => edit(current ?? productsBaselineQuery.data?.lines ?? []));
  }

  function updateOpportunityProductQuantity(productId: number, value: number | null) {
    if (
      value === null ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > maximumOpportunityProductInput
    ) {
      return;
    }
    editOpportunityProducts((current) =>
      current.map((product) =>
        product.productId === productId ? { ...product, quantity: value } : product,
      ),
    );
  }

  function updateOpportunityProductUnitPrice(productId: number, value: number | null) {
    if (
      value !== null &&
      (!Number.isFinite(value) || value < 0 || value > maximumOpportunityProductInput)
    ) {
      return;
    }
    editOpportunityProducts((current) =>
      current.map((product) =>
        product.productId === productId
          ? { ...product, ...(value === null ? { unitPrice: undefined } : { unitPrice: value }) }
          : product,
      ),
    );
  }

  async function resolveDeleteConflict(resolution: MutationConflictResolution) {
    if (resolution === "dismiss") {
      deleteMutation.reset();
      return;
    }

    await opportunityQuery.refetch();
    deleteMutation.reset();
  }

  return (
    <RouteAuthority authority={authority.opportunitiesRead}>
      <main className={styles.page}>
        <section className={styles.heading}>
          <div>
            <Button icon={<ArrowLeftOutlined />} type="link" onClick={closeDetail}>
              返回商机列表
            </Button>
            <div className={styles.titleRow}>
              <Typography.Title level={2}>{opportunity.name}</Typography.Title>
              {opportunity.starred ? <StarFilled aria-label="已关注" /> : null}
              {opportunity.status ? <Tag>{opportunity.status}</Tag> : null}
              {opportunity.outcome ? <Tag>{opportunity.outcome}</Tag> : null}
            </div>
            <Typography.Text type="secondary">
              普通详情仅展示服务端详情投影；基础编辑、协作者和关联联系人管理都会另行取得安全基线。关联联系人和产品按各自权限边界读取，金额和协作者不会进入详情缓存或此页面；自定义字段和字段附件仅展示服务端当前回显内容。
            </Typography.Text>
            <div className={styles.actions}>
              <Space wrap>
                <Button
                  icon={opportunity.starred ? <StarFilled /> : <StarOutlined />}
                  loading={starMutation.isPending}
                  onClick={() => starMutation.mutate(!opportunity.starred)}
                >
                  {opportunity.starred ? "取消关注" : "关注"}
                </Button>
                <ApprovalStartAction
                  objectType="OPPORTUNITY"
                  subjectId={opportunity.id}
                  onStarted={() => {
                    void queryClient.invalidateQueries({
                      queryKey: opportunityKeys.detail(identityKey, opportunity.id),
                    });
                    void queryClient.invalidateQueries({
                      queryKey: opportunityKeys.lists(identityKey),
                    });
                  }}
                />
                <ActionAuthority authority={authority.opportunitiesWrite}>
                  <Button onClick={() => navigate(`/crm/opportunities/${opportunityId}/edit`)}>
                    编辑基础信息
                  </Button>
                  <ActionAuthority authority={authority.opportunityPipelinesRead}>
                    <Button
                      onClick={() => {
                        stageMutation.reset();
                        setTargetStageCode(opportunity.stageCode ?? undefined);
                        setStagePickerOpen(true);
                      }}
                    >
                      推进阶段
                    </Button>
                  </ActionAuthority>
                </ActionAuthority>
                {opportunity.status === "ACTIVE" ? (
                  <ActionAuthority authority={authority.opportunitiesWrite}>
                    <Button
                      onClick={() => {
                        outcomeMutation.reset();
                        setTargetOutcome(
                          isOpportunityOutcome(opportunity.outcome) ? opportunity.outcome : "OPEN",
                        );
                        setOutcomeRemark(opportunity.outcomeRemark ?? "");
                        setOutcomePickerOpen(true);
                      }}
                    >
                      更新结果
                    </Button>
                  </ActionAuthority>
                ) : null}
                <ActionAuthority authority={authority.opportunitiesAssign}>
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
                <ActionAuthority authority={authority.opportunitiesWrite}>
                  <ActionAuthority authority={authority.productsRead}>
                    <Button
                      onClick={() => {
                        productMutation.reset();
                        setProductKeyword("");
                        setProductDraft(null);
                        setProductPickerOpen(true);
                      }}
                    >
                      管理关联产品
                    </Button>
                  </ActionAuthority>
                  <ActionAuthority authority={authority.contactsRead}>
                    <Button
                      onClick={() => {
                        contactMutation.reset();
                        setContactKeyword("");
                        setContactDraft(null);
                        setContactPickerOpen(true);
                      }}
                    >
                      管理关联联系人
                    </Button>
                    <Button
                      disabled={contactsQuery.isError || contactsQuery.isLoading}
                      onClick={() => {
                        primaryContactMutation.reset();
                        setTargetPrimaryContactId(
                          contactsQuery.data?.find((contact) => contact.primary)?.id ?? "clear",
                        );
                        setPrimaryContactPickerOpen(true);
                      }}
                    >
                      设置首要联系人
                    </Button>
                  </ActionAuthority>
                </ActionAuthority>
                <ActionAuthority authority={authority.opportunitiesWrite}>
                  <Popconfirm
                    cancelText="取消"
                    description="仅服务端确认当前成员为商机协作者时才会退出；负责人和其他成员不会由浏览器判断或修改。"
                    okButtonProps={{ danger: true }}
                    okText="确认退出"
                    title="确认退出该商机协作？"
                    onConfirm={() => exitCollaboratorMutation.mutate(opportunity.version)}
                  >
                    <Button danger loading={exitCollaboratorMutation.isPending}>
                      退出协作
                    </Button>
                  </Popconfirm>
                </ActionAuthority>
                <ActionAuthority authority={authority.opportunitiesDelete}>
                  <Popconfirm
                    cancelText="取消"
                    description="删除后商机会进入服务端软删除状态，并由服务端撤回其附件与文件字段绑定。服务端会再次确认当前 version。"
                    okButtonProps={{ danger: true }}
                    okText="确认删除"
                    title={`删除商机“${opportunity.name}”？`}
                    onConfirm={() => {
                      deleteMutation.reset();
                      deleteMutation.mutate(opportunity.version);
                    }}
                  >
                    <Button
                      danger
                      disabled={deleteMutation.isPending}
                      loading={deleteMutation.isPending}
                    >
                      删除商机
                    </Button>
                  </Popconfirm>
                </ActionAuthority>
              </Space>
            </div>
            {starMutation.isError ? (
              <Alert title="商机关注状态暂时无法更新" showIcon type="error" />
            ) : null}
            {exitCollaboratorMutation.isError ? (
              <Alert
                title={
                  exitCollaboratorMutation.error instanceof ApiError
                    ? exitCollaboratorMutation.error.message
                    : "暂时无法退出商机协作"
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
                    : "商机暂时无法删除"
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
          </div>
        </section>

        <Card title="基本信息">
          <Descriptions column={{ sm: 1, md: 2 }}>
            <Descriptions.Item label="客户">
              {opportunity.customerId === null ? "—" : `客户 ${opportunity.customerId}`}
            </Descriptions.Item>
            <Descriptions.Item label="负责人">
              {opportunity.ownerActorId === null ? "—" : `成员 ${opportunity.ownerActorId}`}
            </Descriptions.Item>
            <Descriptions.Item label="销售管线">
              {displayValue(opportunity.pipelineCode)}
            </Descriptions.Item>
            <Descriptions.Item label="销售阶段">
              {displayValue(opportunity.stageCode)}
            </Descriptions.Item>
            <Descriptions.Item label="预计成交日期">
              {displayValue(opportunity.expectedCloseDate)}
            </Descriptions.Item>
            <Descriptions.Item label="预计成交金额">
              {formatServerAmount(opportunity.estimatedAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="下次联系时间">
              {displayValue(opportunity.nextContactTime)}
            </Descriptions.Item>
            <Descriptions.Item label="结果时间">
              {displayValue(opportunity.outcomeTime)}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {displayValue(opportunity.createdTime)}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {displayValue(opportunity.updatedTime)}
            </Descriptions.Item>
          </Descriptions>
        </Card>
        {canReadFieldMetadata && fieldDefinitionsQuery.isLoading ? (
          <Card title="自定义字段">
            <Spin aria-label="正在加载商机自定义字段目录" />
          </Card>
        ) : null}
        {canReadFieldMetadata && fieldDefinitionsQuery.isError ? (
          <Card title="自定义字段">
            <Alert title="商机自定义字段目录暂时无法加载" showIcon type="error" />
          </Card>
        ) : null}
        {opportunityDynamicFields.length > 0 ? (
          <Card title="自定义字段">
            <Typography.Paragraph type="secondary">
              值仅按服务端当前返回展示；不会作为编辑或字段权限判断的依据。
            </Typography.Paragraph>
            <ServerProvidedDynamicFieldDescriptions
              columns={{ sm: 1, xs: 1 }}
              definitions={fieldDefinitionsQuery.data ?? []}
              values={opportunity.customFields}
            />
          </Card>
        ) : null}
        <ControlledFileFieldDownloadCard
          canRead={canReadFileFields}
          fileFields={opportunity.fileFields}
          targetId={opportunity.id}
          targetType="opportunity"
          title="字段附件"
        />

        {canReadContacts ? (
          <Card title="关联联系人">
            {contactsQuery.isError ? (
              <Alert title="商机联系人暂时无法加载" showIcon type="error" />
            ) : (
              <List
                dataSource={[...(contactsQuery.data ?? [])]}
                loading={contactsQuery.isLoading}
                locale={{ emptyText: "暂无关联联系人" }}
                renderItem={(contact) => (
                  <List.Item extra={contact.primary ? <Tag color="blue">首要联系人</Tag> : null}>
                    <List.Item.Meta description={`联系人 ${contact.id}`} title={contact.name} />
                  </List.Item>
                )}
              />
            )}
          </Card>
        ) : null}

        {canReadProducts ? (
          <Card title="关联产品">
            {productsQuery.isError ? (
              <Alert title="商机产品快照暂时无法加载" showIcon type="error" />
            ) : (
              <List
                dataSource={[...(productsQuery.data?.lines ?? [])]}
                loading={productsQuery.isLoading}
                locale={{ emptyText: "暂无关联产品" }}
                renderItem={(product) => {
                  const details = [
                    product.productCode === null ? null : `编码 ${product.productCode}`,
                    product.categoryName === null ? null : product.categoryName,
                    product.unit === null ? null : `单位 ${product.unit}`,
                    product.quantity === null ? null : `数量 ${product.quantity}`,
                  ].filter((value): value is string => value !== null);
                  return (
                    <List.Item>
                      <List.Item.Meta
                        description={details.length === 0 ? undefined : details.join(" · ")}
                        title={product.productName}
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        ) : null}

        {opportunity.description ? (
          <Card title="备注">
            <Typography.Paragraph className={styles.description}>
              {opportunity.description}
            </Typography.Paragraph>
          </Card>
        ) : null}
        {opportunity.outcomeRemark ? (
          <Card title="结果说明">
            <Typography.Paragraph className={styles.description}>
              {opportunity.outcomeRemark}
            </Typography.Paragraph>
          </Card>
        ) : null}
        <Modal
          footer={[
            <Button key="cancel" onClick={() => setStagePickerOpen(false)}>
              取消
            </Button>,
            <Button
              key="submit"
              disabled={!targetStageIsActive || currentPipeline === undefined || stageQuery.isError}
              loading={stageMutation.isPending}
              type="primary"
              onClick={() => {
                if (targetStageCode !== undefined) stageMutation.mutate(targetStageCode);
              }}
            >
              更新阶段
            </Button>,
          ]}
          open={stagePickerOpen}
          title="推进销售阶段"
          onCancel={() => setStagePickerOpen(false)}
        >
          <Typography.Paragraph type="secondary">
            只能从当前销售管线的服务端活动阶段中选择；提交时会携带当前版本，服务端会重新校验可写性、活动状态和并发。
          </Typography.Paragraph>
          {!canReadPipelines ? (
            <Alert title="缺少读取销售管线目录的权限" showIcon type="warning" />
          ) : pipelineQuery.isError ? (
            <Alert title="销售管线目录暂时无法加载" showIcon type="error" />
          ) : currentPipeline === undefined ? (
            <Alert title="当前商机的销售管线不在可选择的活动目录中" showIcon type="warning" />
          ) : stageQuery.isError ? (
            <Alert title="销售阶段暂时无法加载" showIcon type="error" />
          ) : (
            <Select
              aria-label="目标销售阶段"
              disabled={stageQuery.isLoading}
              loading={stageQuery.isLoading}
              options={(stageQuery.data ?? []).map((stage) => ({
                label: `${stage.name}（${stage.code}）`,
                value: stage.code,
              }))}
              placeholder="请选择活动销售阶段"
              value={targetStageCode}
              onChange={setTargetStageCode}
            />
          )}
          {stageMutation.isError ? (
            <Alert
              title={
                stageMutation.error instanceof ApiError
                  ? stageMutation.error.message
                  : "商机阶段暂时无法更新"
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
              <Button disabled={contactMutation.isPending} onClick={closeContactPicker}>
                取消
              </Button>
              <Button
                disabled={
                  contactDraft === null ||
                  contactsBaselineQuery.isLoading ||
                  contactsBaselineQuery.isError ||
                  contactsBaselineQuery.data === undefined ||
                  !contactsBaselineQuery.data.editable
                }
                loading={contactMutation.isPending}
                type="primary"
                onClick={() => {
                  const baseline = contactsBaselineQuery.data;
                  if (baseline === undefined || !baseline.editable) return;
                  contactMutation.mutate({
                    contacts: replacementContacts,
                    version: baseline.version,
                  });
                }}
              >
                保存关联联系人
              </Button>
            </>
          }
          open={contactPickerOpen}
          title="管理关联联系人"
          onCancel={closeContactPicker}
        >
          <Typography.Paragraph type="secondary">
            联系人清单仅从服务端完整、可替换的权威基线读取。无法安全提供完整清单时不会允许保存；提交时仍由服务端校验客户归属、字段权限、数据范围和版本。
          </Typography.Paragraph>
          {contactsBaselineQuery.isError ? (
            <Alert title="商机联系人完整基线暂时无法加载" showIcon type="error" />
          ) : contactsBaselineQuery.data?.editable === false ? (
            <Alert
              title="当前权限无法安全获取完整关联联系人，暂不能替换联系人清单。"
              showIcon
              type="warning"
            />
          ) : (
            <List
              dataSource={[...replacementContacts]}
              loading={contactsBaselineQuery.isLoading}
              locale={{ emptyText: "暂无关联联系人" }}
              renderItem={(contact) => (
                <List.Item
                  actions={[
                    <Button
                      disabled={contactMutation.isPending || contact.primary}
                      key={`primary-${contact.id}`}
                      type="link"
                      onClick={() =>
                        editOpportunityContacts((current) =>
                          current.map((item) => ({ ...item, primary: item.id === contact.id })),
                        )
                      }
                    >
                      {contact.primary ? "首要联系人" : "设为首要"}
                    </Button>,
                    <Button
                      danger
                      disabled={contactMutation.isPending}
                      key={`remove-${contact.id}`}
                      type="link"
                      onClick={() =>
                        editOpportunityContacts((current) =>
                          current.filter((item) => item.id !== contact.id),
                        )
                      }
                    >
                      移除
                    </Button>,
                  ]}
                >
                  <List.Item.Meta description={`联系人 ${contact.id}`} title={contact.name} />
                </List.Item>
              )}
            />
          )}
          {contactsBaselineQuery.data?.editable ? (
            <>
              <Typography.Title level={5}>添加联系人</Typography.Title>
              <Input.Search
                allowClear
                aria-label="按联系人姓名搜索"
                placeholder="按联系人姓名搜索"
                value={contactKeyword}
                onChange={(event) => setContactKeyword(event.target.value)}
              />
              {contactCandidateQuery.isError ? (
                <Alert
                  title="可添加联系人暂时无法加载"
                  showIcon
                  style={{ marginTop: 12 }}
                  type="error"
                />
              ) : (
                <List
                  dataSource={editableContactOptions}
                  loading={contactCandidateQuery.isLoading}
                  locale={{ emptyText: "未找到可添加联系人" }}
                  renderItem={(contact) => (
                    <List.Item
                      actions={[
                        <Button
                          disabled={contactMutation.isPending}
                          key={contact.id}
                          type="link"
                          onClick={() =>
                            editOpportunityContacts((current) => [
                              ...current,
                              { id: contact.id, name: contact.name, primary: false },
                            ])
                          }
                        >
                          添加
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta description={`联系人 ${contact.id}`} title={contact.name} />
                    </List.Item>
                  )}
                />
              )}
            </>
          ) : null}
          {contactMutation.isError ? (
            <Alert
              title={
                contactMutation.error instanceof ApiError
                  ? contactMutation.error.message
                  : "商机关联联系人暂时无法更新"
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
              <Button disabled={productMutation.isPending} onClick={closeProductPicker}>
                取消
              </Button>
              <Button
                disabled={
                  productDraft === null ||
                  productsBaselineQuery.isLoading ||
                  productsBaselineQuery.isError ||
                  productsBaselineQuery.data === undefined
                }
                loading={productMutation.isPending}
                type="primary"
                onClick={() => {
                  const baseline = productsBaselineQuery.data;
                  if (baseline === undefined) return;
                  productMutation.mutate({ lines: replacementProducts, version: baseline.version });
                }}
              >
                保存关联产品
              </Button>
            </>
          }
          open={productPickerOpen}
          title="管理关联产品"
          onCancel={closeProductPicker}
        >
          <Typography.Paragraph type="secondary">
            产品清单只从服务端完整、版本化快照读取。可修改每行数量和成交单价；新添产品的单价留空时，系统采用当前目录价。此处不显示或计算折扣、行金额和总额。
          </Typography.Paragraph>
          {productsBaselineQuery.isError ? (
            <Alert title="商机产品完整基线暂时无法加载" showIcon type="error" />
          ) : (
            <List
              dataSource={[...replacementProducts]}
              loading={productsBaselineQuery.isLoading}
              locale={{ emptyText: "暂未关联产品；可按商机需要保持空集合" }}
              renderItem={(product) => {
                const details = [
                  product.productCode === null ? null : `编码 ${product.productCode}`,
                  product.categoryName,
                  product.unit === null ? null : `单位 ${product.unit}`,
                ].filter((value): value is string => value !== null);
                return (
                  <List.Item
                    actions={[
                      <Button
                        danger
                        disabled={productMutation.isPending}
                        key={`remove-${product.productId}`}
                        type="link"
                        onClick={() =>
                          editOpportunityProducts((current) =>
                            current.filter((item) => item.productId !== product.productId),
                          )
                        }
                      >
                        移除
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      description={details.length === 0 ? undefined : details.join(" · ")}
                      title={product.productName}
                    />
                    <Space wrap>
                      <Typography.Text type="secondary">数量</Typography.Text>
                      <InputNumber
                        aria-label={`${product.productName} 数量`}
                        controls={false}
                        disabled={productMutation.isPending}
                        inputMode="decimal"
                        max={maximumOpportunityProductInput}
                        min={0.0001}
                        precision={4}
                        value={product.quantity}
                        onChange={(value) =>
                          updateOpportunityProductQuantity(product.productId, value)
                        }
                      />
                      <Typography.Text type="secondary">成交单价</Typography.Text>
                      <InputNumber
                        aria-label={`${product.productName} 成交单价`}
                        controls={false}
                        disabled={productMutation.isPending}
                        inputMode="decimal"
                        max={maximumOpportunityProductInput}
                        min={0}
                        precision={2}
                        placeholder="按目录价"
                        value={product.unitPrice}
                        onChange={(value) =>
                          updateOpportunityProductUnitPrice(product.productId, value)
                        }
                      />
                    </Space>
                  </List.Item>
                );
              }}
            />
          )}
          <Typography.Title level={5}>添加产品</Typography.Title>
          <Input.Search
            allowClear
            aria-label="按产品名称或编码搜索"
            placeholder="按产品名称或编码搜索"
            value={productKeyword}
            onChange={(event) => setProductKeyword(event.target.value)}
          />
          {productCandidateQuery.isError ? (
            <Alert title="可添加产品暂时无法加载" showIcon style={{ marginTop: 12 }} type="error" />
          ) : (
            <List
              dataSource={editableProductOptions}
              loading={productCandidateQuery.isLoading}
              locale={{ emptyText: "未找到可添加产品" }}
              renderItem={(product) => (
                <List.Item
                  actions={[
                    <Button
                      disabled={
                        productMutation.isPending ||
                        productsBaselineQuery.isLoading ||
                        productsBaselineQuery.isError ||
                        productsBaselineQuery.data === undefined
                      }
                      key={product.id}
                      type="link"
                      onClick={() =>
                        editOpportunityProducts((current) => [
                          ...current,
                          {
                            categoryName: product.categoryName,
                            productCode: product.code,
                            productId: product.id,
                            productName: product.name,
                            quantity: 1,
                            unit: product.unit,
                          },
                        ])
                      }
                    >
                      添加
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    description={
                      [
                        product.code === null ? null : `编码 ${product.code}`,
                        product.categoryName,
                        product.unit === null ? null : `单位 ${product.unit}`,
                      ]
                        .filter((value): value is string => value !== null)
                        .join(" · ") || undefined
                    }
                    title={product.name}
                  />
                </List.Item>
              )}
            />
          )}
          {productMutation.isError ? (
            <Alert
              title={
                productMutation.error instanceof ApiError
                  ? productMutation.error.message
                  : "商机关联产品暂时无法更新"
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : null}
        </Modal>
        <Modal
          footer={[
            <Button key="cancel" onClick={closePrimaryContactPicker}>
              取消
            </Button>,
            <Button
              key="submit"
              disabled={contactsQuery.isError || contactsQuery.isLoading}
              loading={primaryContactMutation.isPending}
              type="primary"
              onClick={() =>
                primaryContactMutation.mutate(
                  targetPrimaryContactId === "clear" ? null : targetPrimaryContactId,
                )
              }
            >
              保存首要联系人
            </Button>,
          ]}
          open={primaryContactPickerOpen}
          title="设置首要联系人"
          onCancel={closePrimaryContactPicker}
        >
          <Typography.Paragraph type="secondary">
            仅能从服务端返回的当前关联联系人中选择。保存只修改首要联系人字段并携带当前版本，不会替换联系人清单。
          </Typography.Paragraph>
          {contactsQuery.isError ? (
            <Alert title="商机联系人暂时无法加载" showIcon type="error" />
          ) : (
            <Select
              aria-label="首要联系人"
              disabled={contactsQuery.isLoading}
              loading={contactsQuery.isLoading}
              options={[
                { label: "不设置首要联系人", value: "clear" },
                ...(contactsQuery.data ?? []).map((contact) => ({
                  label: contact.name,
                  value: contact.id,
                })),
              ]}
              value={targetPrimaryContactId}
              onChange={setTargetPrimaryContactId}
            />
          )}
          {primaryContactMutation.isError ? (
            <Alert
              title={
                primaryContactMutation.error instanceof ApiError
                  ? primaryContactMutation.error.message
                  : "商机首要联系人暂时无法更新"
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : null}
        </Modal>
        <Modal
          footer={[
            <Button key="cancel" onClick={() => setOutcomePickerOpen(false)}>
              取消
            </Button>,
            <Button
              key="submit"
              loading={outcomeMutation.isPending}
              type="primary"
              onClick={() =>
                outcomeMutation.mutate({ outcome: targetOutcome, remark: outcomeRemark })
              }
            >
              更新结果
            </Button>,
          ]}
          open={outcomePickerOpen}
          title="更新商机结果"
          onCancel={() => setOutcomePickerOpen(false)}
        >
          <Typography.Paragraph type="secondary">
            结果与说明由服务端按当前字段权限和版本复核；恢复跟进会清除结果说明，浏览器不保留或推断历史值。
          </Typography.Paragraph>
          <Select
            aria-label="商机结果"
            options={outcomeOptions}
            value={targetOutcome}
            onChange={(outcome) => {
              setTargetOutcome(outcome);
              if (outcome === "OPEN") setOutcomeRemark("");
            }}
          />
          {targetOutcome !== "OPEN" ? (
            <Input.TextArea
              aria-label="结果说明"
              maxLength={1000}
              placeholder="可选填写结果说明"
              style={{ marginTop: 12 }}
              value={outcomeRemark}
              onChange={(event) => setOutcomeRemark(event.target.value)}
            />
          ) : null}
          {outcomeMutation.isError ? (
            <Alert
              title={
                outcomeMutation.error instanceof ApiError
                  ? outcomeMutation.error.message
                  : "商机结果暂时无法更新"
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
            仅显示服务端允许当前成员查看的在职成员；最终可分配范围、字段权限和并发仍由服务端校验。
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
                      disabled={
                        ownerMutation.isPending || member.actorId === opportunity.ownerActorId
                      }
                      key={member.actorId}
                      loading={ownerMutation.isPending}
                      type="link"
                      onClick={() =>
                        ownerMutation.mutate({
                          actorId: member.actorId,
                          version: opportunity.version,
                        })
                      }
                    >
                      {member.actorId === opportunity.ownerActorId ? "当前负责人" : "选择"}
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
                  : "商机负责人暂时无法更新"
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
                  collaboratorsQuery.isLoading ||
                  collaboratorsQuery.isError ||
                  collaboratorsQuery.data === undefined
                }
                loading={collaboratorMutation.isPending}
                type="primary"
                onClick={() => {
                  const baseline = collaboratorsQuery.data;
                  if (baseline === undefined) return;
                  collaboratorMutation.mutate({ collaborators, version: baseline.version });
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
            协作者清单只从服务端权威基线读取并完整替换。读取异常时不会允许保存；最终成员范围、读写权限和并发仍由服务端校验。
          </Typography.Paragraph>
          {collaboratorsQuery.isError ? (
            <Alert title="商机协作者暂时无法加载" showIcon type="error" />
          ) : (
            <List
              dataSource={[...collaborators]}
              loading={collaboratorsQuery.isLoading}
              locale={{ emptyText: "暂无协作者" }}
              renderItem={(collaborator) => (
                <List.Item
                  actions={[
                    <Select<OpportunityCollaboratorAccess>
                      aria-label={`成员 ${collaborator.actorId} 的协作权限`}
                      disabled={collaboratorMutation.isPending}
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
                      disabled={collaboratorMutation.isPending}
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
                aria-label="按成员姓名搜索"
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
                          disabled={collaboratorMutation.isPending}
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
                  : "商机协作者暂时无法更新"
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : null}
        </Modal>
        <ActivityTimelineCard subjectId={opportunity.id} subjectType="OPPORTUNITY" />
      </main>
    </RouteAuthority>
  );
}
