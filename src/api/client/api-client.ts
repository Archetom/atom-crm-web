import createClient from "openapi-fetch";

import type { AuthAdapter } from "~/app/auth/auth-adapter";
import type { components, paths } from "~/api/generated/schema";
import type { ProductImageType } from "~/features/products/model/product-image";
import { ApiError } from "~/api/errors/api-error";
import {
  decodeFieldDefinitions,
  decodeFieldLayout,
  type FieldDefinition,
  type FieldLayout,
} from "~/components/dynamic-field";
import { decodeMemberOptions, type MemberOption } from "~/components/entity-selector/member-option";
import {
  decodeDepartmentOptions,
  type DepartmentOption,
} from "~/components/entity-selector/department-option";
import {
  decodeCustomerOptions,
  type CustomerOption,
} from "~/components/entity-selector/customer-option";
import type { MemberAuthorization, NavigationItem } from "~/shared/types/api";
import {
  toCustomerBusinessOverview,
  type CustomerBusinessOverview,
} from "~/features/customers/model/customer-business-overview";
import {
  decodeCustomerCollaboratorBaseline,
  type CustomerCollaboratorBaseline,
} from "~/features/customers/model/customer-collaborator";
import { toCustomerDetail, type CustomerDetail } from "~/features/customers/model/customer-detail";
import {
  toCustomerHierarchy,
  type CustomerHierarchy,
} from "~/features/customers/model/customer-hierarchy";
import { decodeCustomerTagCatalog } from "~/features/customers/model/customer-tag";
import { toContactDetail, type ContactDetail } from "~/features/contacts/model/contact-detail";
import {
  decodeContactCollaboratorBaseline,
  type ContactCollaboratorBaseline,
} from "~/features/contacts/model/contact-collaborator";
import {
  toContactHierarchy,
  type ContactHierarchy,
} from "~/features/contacts/model/contact-hierarchy";
import { decodeContactTagCatalog } from "~/features/contacts/model/contact-tag";
import {
  decodeLeadCollaboratorBaseline,
  type LeadCollaboratorBaseline,
} from "~/features/leads/model/lead-collaborator";
import { toLeadConversion, type LeadConversion } from "~/features/leads/model/lead-conversion";
import { toLeadDetail, type LeadDetail } from "~/features/leads/model/lead-detail";
import { toLeadHierarchy, type LeadHierarchy } from "~/features/leads/model/lead-hierarchy";
import { decodeLeadTagCatalog } from "~/features/leads/model/lead-tag";
import {
  toOpportunityDetail,
  type OpportunityDetail,
} from "~/features/opportunities/model/opportunity-detail";
import {
  toOpportunityEditableBaseline,
  type OpportunityEditableBaseline,
} from "~/features/opportunities/model/opportunity-form";
import {
  decodeOpportunityCollaboratorBaseline,
  type OpportunityCollaboratorBaseline,
} from "~/features/opportunities/model/opportunity-collaborator";
import {
  decodeOpportunityOptions,
  toOpportunityOption,
  type OpportunityOption,
} from "~/features/opportunities/model/opportunity-option";
import {
  decodeOpportunityContacts,
  type OpportunityContact,
} from "~/features/opportunities/model/opportunity-contact";
import {
  decodeOpportunityContactsBaseline,
  type OpportunityContactsBaseline,
} from "~/features/opportunities/model/opportunity-contacts-baseline";
import {
  toOpportunityProductSnapshot,
  type OpportunityProductSnapshot,
} from "~/features/opportunities/model/opportunity-product-snapshot";
import {
  decodeOpportunityProductBaseline,
  type OpportunityProductBaseline,
} from "~/features/opportunities/model/opportunity-product-baseline";
import {
  toOpportunitySummary,
  type OpportunitySummary,
} from "~/features/opportunities/model/opportunity-summary";
import { toProductDetail, type ProductDetail } from "~/features/products/model/product-detail";
import {
  decodeProductCategory,
  decodeProductCategoryTree,
  type ProductCategory,
} from "~/features/products/model/product-category";
import {
  toProductEditableBaseline,
  type ProductEditableBaseline,
} from "~/features/products/model/product-form";
import {
  decodeOpportunityPipelineOptions,
  decodeOpportunityPipelineStageOptions,
  type OpportunityPipelineOption,
  type OpportunityPipelineStageOption,
} from "~/features/opportunities/model/opportunity-pipeline-option";
import {
  toOpportunityPipelineCatalogItem,
  toOpportunityPipelineStageCatalogItem,
  type OpportunityPipelineCatalogItem,
  type OpportunityPipelineStageCatalogItem,
} from "~/features/opportunities/model/opportunity-pipeline-catalog";
import {
  decodeContactPoolCatalog,
  type ContactPoolCatalogItem,
} from "~/features/contact-pools/model/contact-pool-catalog";
import {
  decodeActivityMethodOptions,
  type ActivityMethodOption,
} from "~/features/activities/model/activity-option";
import { toActivityDetail, type ActivityDetail } from "~/features/activities/model/activity-detail";
import {
  toReturnVisitDetail,
  type ReturnVisitDetail,
} from "~/features/return-visits/model/return-visit-detail";
import { toContractDetail, type ContractDetail } from "~/features/contracts/model/contract-detail";
import {
  decodeContractOptions,
  toContractOption,
  type ContractOption,
} from "~/features/contracts/model/contract-option";
import {
  decodeContractCollaboratorBaseline,
  type ContractCollaboratorBaseline,
} from "~/features/contracts/model/contract-collaborator";
import {
  decodeContractProductBaseline,
  type ContractProductBaseline,
} from "~/features/contracts/model/contract-product-baseline";
import {
  decodeInvoiceProfileList,
  toInvoiceProfileListItem,
  type InvoiceProfileListItem,
} from "~/features/invoice-profiles/model/invoice-profile-list-item";
import {
  toInvoiceListItem,
  type InvoiceListItem,
} from "~/features/invoices/model/invoice-list-item";
import {
  toReceivableListItem,
  type ReceivableListItem,
} from "~/features/receivables/model/receivable-list-item";
import {
  toReceivablePlanListItem,
  type ReceivablePlanListItem,
} from "~/features/receivable-plans/model/receivable-plan-list-item";
import {
  decodeReceivablePlanOptions,
  toReceivablePlanOption,
  toReceivablePlanSelectionItem,
  type ReceivablePlanOption,
  type ReceivablePlanSelectionItem,
} from "~/features/receivable-plans/model/receivable-plan-option";
import {
  toWorkTaskListItem,
  type WorkTaskListItem,
} from "~/features/work-tasks/model/work-task-list-item";
import {
  toWorkTaskCommentListItem,
  type WorkTaskCommentListItem,
} from "~/features/work-tasks/model/work-task-comment-list-item";
import {
  toWorkTaskEditBaseline,
  type WorkTaskEditBaseline,
} from "~/features/work-tasks/model/work-task-edit-baseline";
import {
  toWorkTaskFollowerBaseline,
  type WorkTaskFollowerBaseline,
} from "~/features/work-tasks/model/work-task-follower-baseline";
import {
  toWorkTaskReminderPlan,
  toWorkTaskSeriesReminderPlan,
  type WorkTaskReminderPlan,
  type WorkTaskSeriesReminderPlan,
} from "~/features/work-tasks/model/work-task-reminder-plan";
import {
  toWorkTaskSeriesDetail,
  toWorkTaskSeriesMutationResult,
  type WorkTaskSeriesDetail,
  type WorkTaskSeriesMutationResult,
} from "~/features/work-tasks/model/work-task-series-detail";
import { toWorklistPage, type WorklistPage } from "~/features/worklist/model/worklist-page";
import {
  toNotificationPreference,
  type NotificationPreference,
} from "~/features/notifications/model/notification-preference";
import {
  toNotificationInboxItem,
  type NotificationInboxItem,
} from "~/features/notifications/model/notification-inbox-item";
import {
  toApprovalPendingPage,
  type ApprovalPendingPage,
} from "~/features/approvals/model/approval-pending-item";
import { toApprovalPendingCount } from "~/features/approvals/model/approval-pending-count";
import {
  toApprovalActionResult,
  toApprovalPendingDetail,
  type ApprovalPendingDetail,
} from "~/features/approvals/model/approval-pending-detail";
import {
  toApprovalTransferCandidatePage,
  type ApprovalTransferCandidatePage,
} from "~/features/approvals/model/approval-transfer-candidate";
import {
  toApprovalBatchActionResult,
  type ApprovalBatchActionResult,
} from "~/features/approvals/model/approval-batch-action";
import {
  toApprovalRoutePreview,
  toApprovalStartCandidatePage,
  toApprovalStartOptions,
  type ApprovalRoutePreview,
  type ApprovalStartCandidatePage,
  type ApprovalStartOptions,
} from "~/features/approvals/model/approval-start";
import {
  toStageWorkflowDefinitionDetail,
  type StageWorkflowDefinitionDetail,
} from "~/features/stage-workflows/model/stage-workflow-detail";
import {
  toStageWorkflowSummaryPage,
  type StageWorkflowSummaryPage,
} from "~/features/stage-workflows/model/stage-workflow-summary";
import {
  toStageWorkflowApplicableOptions,
  toStageWorkflowActionRecord,
  toStageWorkflowFileDraft,
  toStageWorkflowFieldCandidatePage,
  toStageWorkflowRecord,
  toStageWorkflowUploadedFile,
  type StageWorkflowApplicableOptions,
  type StageWorkflowFileDraft,
  type StageWorkflowFieldCandidatePage,
  type StageWorkflowRecord,
  type StageWorkflowUploadedFile,
} from "~/features/stage-workflows/model/stage-workflow-runtime";
import {
  toStageWorkflowConfigurationCandidatePage,
  toStageWorkflowConfigurationOptions,
  toStageWorkflowEditableBaseline,
  toStageWorkflowMutationResult,
  type StageWorkflowConfigurationCandidatePage,
  type StageWorkflowConfigurationCandidateType,
  type StageWorkflowConfigurationOptions,
  type StageWorkflowEditableBaseline,
  type StageWorkflowMutationResult,
  type StageWorkflowObjectType,
} from "~/features/stage-workflows/model/stage-workflow-configuration";
import {
  isStageWorkflowCommentDeleted,
  toStageWorkflowComment,
  toStageWorkflowCommentPage,
  type StageWorkflowComment,
  type StageWorkflowCommentPage,
} from "~/features/stage-workflows/model/stage-workflow-comment";
import {
  toApprovalDefinitionPage,
  toApprovalDefinitionListItem,
  type ApprovalDefinitionPage,
  type ApprovalDefinitionListItem,
} from "~/features/approvals/model/approval-definition-list-item";
import {
  toApprovalDefinitionStatusBaseline,
  type ApprovalDefinitionStatusBaseline,
} from "~/features/approvals/model/approval-definition-status";
import {
  toApprovalDefinitionEditableBaseline,
  type ApprovalDefinitionEditableBaseline,
} from "~/features/approvals/model/approval-definition-edit";

import { createControlledDownload, type ControlledDownload } from "./controlled-download";
import { isoDateTime, nonBlankString, positiveInteger, recordOf } from "~/shared/utils/decode";

type ContactPoolConfigurationQuery = NonNullable<
  NonNullable<paths["/api/v1/contact-pools"]["get"]>["parameters"]
>["query"];

type CustomerPoolConfigurationQuery = NonNullable<
  NonNullable<paths["/api/v1/customer-pools"]["get"]>["parameters"]
>["query"];

type LeadNearbyQuery = NonNullable<
  NonNullable<paths["/api/v1/leads/nearby"]["get"]>["parameters"]
>["query"];

type CustomerNearbyQuery = NonNullable<
  NonNullable<paths["/api/v1/customers/nearby"]["get"]>["parameters"]
>["query"];

type ContactNearbyQuery = NonNullable<
  NonNullable<paths["/api/v1/contacts/nearby"]["get"]>["parameters"]
>["query"];

type EmbeddedPageQuery = NonNullable<
  NonNullable<paths["/api/v1/embedded-pages"]["get"]>["parameters"]
>["query"];

type ConnectorQuery = components["schemas"]["ConnectorQueryRequest"];

type ApprovalTransferCandidateQuery = NonNullable<
  NonNullable<paths["/api/v1/approvals/{instanceId}/transfer-candidates"]["get"]>["parameters"]
>["query"];

type ApprovalStartSelectionCandidateQuery = NonNullable<
  NonNullable<
    paths["/api/v1/approvals/subjects/{objectType}/{subjectId}/start-options/{definitionId}/selections/{selectionCode}/candidates"]["get"]
  >["parameters"]
>["query"];

type OaAnnouncementAudienceCandidateQuery = NonNullable<
  NonNullable<paths["/api/v1/oa/announcements/audience-candidates"]["get"]>["parameters"]
>["query"];

type StageWorkflowCommentQuery = NonNullable<
  NonNullable<
    paths["/api/v1/stage-workflow-records/{workflowRecordId}/comments"]["get"]
  >["parameters"]
>["query"];

type StageWorkflowAdvanceSelectionCandidateQuery = NonNullable<
  NonNullable<
    paths["/api/v1/stage-workflow-records/{workflowRecordId}/advance-options/{selectionCode}/candidates"]["get"]
  >["parameters"]
>["query"];

type StageWorkflowConfigurationCandidateQuery = Omit<
  NonNullable<
    NonNullable<
      paths["/api/v1/stage-workflows/configuration-options/candidates"]["get"]
    >["parameters"]
  >["query"],
  "candidateType"
>;

type OaFormFieldCandidateQuery = NonNullable<
  NonNullable<
    paths["/api/v1/oa/forms/available/{formId}/fields/{fieldCode}/candidates"]["get"]
  >["parameters"]
>["query"];

type OaFormApprovalSelectionCandidateQuery = NonNullable<
  NonNullable<
    paths["/api/v1/oa/forms/available/{formId}/approval-selections/{selectionCode}/candidates"]["get"]
  >["parameters"]
>["query"];

interface StageWorkflowFileUploadIntent {
  draftId: number;
  expiresAt: string;
  fieldCode: string;
  fileId: number;
  requiredHeaders: Record<string, string>;
  uploadMethod: "PUT";
  uploadUrl: string;
}

export interface StageWorkflowFileUploadResult {
  draft: StageWorkflowFileDraft;
  files: StageWorkflowUploadedFile[];
}

export interface OaFileFieldUploadResult {
  draft: components["schemas"]["FileFieldDraftResponse"];
  files: components["schemas"]["FileFieldUploadedFileResponse"][];
}

export type CrmFileFieldObjectType =
  | "CUSTOMER"
  | "CONTACT"
  | "LEAD"
  | "OPPORTUNITY"
  | "CONTRACT"
  | "INVOICE"
  | "RECEIVABLE"
  | "RECEIVABLE_PLAN"
  | "PRODUCT"
  | "RETURN_VISIT";

export interface CrmFileFieldUploadResult {
  draft: components["schemas"]["FileFieldDraftResponse"];
  files: components["schemas"]["FileFieldUploadedFileResponse"][];
}

export type ControlledAttachmentTargetType =
  | "import-draft"
  | "work-task"
  | "customer"
  | "contact"
  | "lead"
  | "opportunity"
  | "contract"
  | "invoice"
  | "receivable"
  | "receivable-plan"
  | "product"
  | "return-visit"
  | "marketing-activity"
  | "oa-announcement"
  | "oa-request";

export interface ControlledAttachmentTarget {
  targetType: ControlledAttachmentTargetType;
  targetId: number;
}

export type MarketingActivityImageType = NonNullable<
  components["schemas"]["AttachmentUploadIntentCreateRequest"]["marketingActivityImageType"]
>;

/** Server-defined groups for images rendered with a Product record. */

export interface ControlledAttachmentQuery {
  page: number;
  size: number;
  marketingActivityImageType?: MarketingActivityImageType;
  productImageType?: ProductImageType;
}

export interface ControlledAttachmentUploadOptions {
  marketingActivityImageType?: MarketingActivityImageType;
  productImageType?: ProductImageType;
}

export interface AttachmentDownloadRequest {
  targetType: ControlledAttachmentTargetType;
  targetId: number;
  fileId: number;
}

export interface FileFieldDownloadRequest extends AttachmentDownloadRequest {
  fieldCode: string;
}

/** Identifies one FILE value already projected by an OA request detail response. */
export interface OaRequestFileFieldDownloadRequest {
  fieldCode: string;
  fileId: number;
  requestId: number;
}

export interface ControlledAttachmentUploadResult {
  fileId: number;
  status: components["schemas"]["AttachmentUploadStatusResponse"];
}

/** A private, target-bound FILE candidate that an existing CRM record may bind on save. */
export interface ExistingCrmFileFieldUploadFile {
  displayName: string;
  fileId: number;
  status: components["schemas"]["AttachmentUploadStatusResponse"];
}

export interface ExistingCrmFileFieldUploadResult {
  fieldCode: string;
  files: ExistingCrmFileFieldUploadFile[];
}

/** Files remain private in this server-issued draft until Product creation consumes them. */
export interface ProductImageDraftUploadResult {
  draft: components["schemas"]["ProductImageDraftResponse"];
  files: components["schemas"]["ProductImageUploadStatusResponse"][];
}

export interface ApiClient {
  getAuthorization(): Promise<MemberAuthorization>;
  getNavigation(): Promise<NavigationItem[]>;
  getAccessibleTenants(): Promise<components["schemas"]["TenantAccessResponse"][]>;
  validateTenantAccess(
    targetTenantId: number,
  ): Promise<components["schemas"]["TenantAccessResponse"]>;
  getLeadIntakeClients(): Promise<components["schemas"]["LeadIntakeClientResponse"][]>;
  createLeadIntakeClient(): Promise<components["schemas"]["LeadIntakeClientCreatedResponse"]>;
  deactivateLeadIntakeClient(
    clientId: number,
    version: number,
  ): Promise<components["schemas"]["LeadIntakeClientResponse"]>;
  getConnectors(query: ConnectorQuery): Promise<components["schemas"]["ConnectorPageResponse"]>;
  getConnector(connectorId: number): Promise<components["schemas"]["ConnectorResponse"]>;
  createConnector(): Promise<components["schemas"]["ConnectorCredentialCreatedResponse"]>;
  rotateConnectorCredential(
    connectorId: number,
    version: number,
  ): Promise<components["schemas"]["ConnectorCredentialCreatedResponse"]>;
  revokeConnectorCredential(
    connectorId: number,
    keyId: string,
    version: number,
  ): Promise<components["schemas"]["ConnectorResponse"]>;
  updateConnectorStatus(
    connectorId: number,
    request: components["schemas"]["ConnectorStatusRequest"],
  ): Promise<components["schemas"]["ConnectorResponse"]>;
  getEnterpriseDataCapabilities(): Promise<
    components["schemas"]["EnterpriseDataCapabilityResponse"]
  >;
  searchEnterpriseData(
    request: components["schemas"]["EnterpriseNameSearchRequest"],
  ): Promise<components["schemas"]["EnterpriseDataObservationResponse"][]>;
  lookupEnterpriseData(
    request: components["schemas"]["EnterpriseIdentifierLookupRequest"],
  ): Promise<components["schemas"]["EnterpriseDataObservationResponse"]>;
  previewEnterpriseDataAdoption(
    request: components["schemas"]["EnterpriseDataAdoptionPreviewRequest"],
  ): Promise<components["schemas"]["EnterpriseDataAdoptionPreviewResponse"]>;
  adoptEnterpriseData(
    request: components["schemas"]["EnterpriseDataAdoptRequest"],
  ): Promise<components["schemas"]["EnterpriseDataAdoptionResponse"]>;
  getNavigationPreference(): Promise<components["schemas"]["NavigationPreferenceResponse"]>;
  updateNavigationPreference(
    request: components["schemas"]["NavigationPreferenceUpdateRequest"],
  ): Promise<components["schemas"]["NavigationPreferenceResponse"]>;
  getEmbeddedPageConfigurationOptions(): Promise<
    components["schemas"]["EmbeddedPageConfigurationOptionsResponse"]
  >;
  getEmbeddedPages(
    query: EmbeddedPageQuery,
  ): Promise<components["schemas"]["EmbeddedPagePageResponse"]>;
  createEmbeddedPage(
    request: components["schemas"]["EmbeddedPageCreateRequest"],
  ): Promise<components["schemas"]["EmbeddedPageResponse"]>;
  updateEmbeddedPage(
    pageId: number,
    request: components["schemas"]["EmbeddedPageUpdateRequest"],
  ): Promise<components["schemas"]["EmbeddedPageResponse"]>;
  deleteEmbeddedPage(pageId: number, version: number): Promise<void>;
  getRenderedEmbeddedPages(
    objectType: string,
    recordId: number,
    platform: string,
  ): Promise<components["schemas"]["RenderedEmbeddedPageResponse"][]>;
  getDashboardOverview(): Promise<components["schemas"]["DashboardOverviewResponse"]>;
  getDashboardPreference(): Promise<components["schemas"]["DashboardPreferenceResponse"]>;
  updateDashboardPreference(
    request: components["schemas"]["DashboardPreferenceUpdateRequest"],
  ): Promise<components["schemas"]["DashboardPreferenceResponse"]>;
  getPerformanceTargets(
    request: components["schemas"]["PerformanceTargetQueryRequest"],
  ): Promise<components["schemas"]["PerformanceTargetListResponse"]>;
  createPerformanceTarget(
    request: components["schemas"]["PerformanceTargetCreateRequest"],
  ): Promise<components["schemas"]["PerformanceTargetResponse"]>;
  importPerformanceTargets(
    request: components["schemas"]["PerformanceTargetImportRequest"],
  ): Promise<components["schemas"]["PerformanceTargetImportResponse"]>;
  updatePerformanceTarget(
    targetId: number,
    request: components["schemas"]["PerformanceTargetUpdateRequest"],
  ): Promise<components["schemas"]["PerformanceTargetResponse"]>;
  deletePerformanceTarget(targetId: number, version: number): Promise<void>;
  getDepartmentPerformanceTargets(
    request: components["schemas"]["DepartmentPerformanceTargetQueryRequest"],
  ): Promise<components["schemas"]["DepartmentPerformanceTargetListResponse"]>;
  createDepartmentPerformanceTarget(
    request: components["schemas"]["DepartmentPerformanceTargetCreateRequest"],
  ): Promise<components["schemas"]["DepartmentPerformanceTargetResponse"]>;
  batchUpsertDepartmentPerformanceTargets(
    request: components["schemas"]["DepartmentPerformanceTargetBatchUpsertRequest"],
  ): Promise<components["schemas"]["DepartmentPerformanceTargetListResponse"]>;
  importDepartmentPerformanceTargets(
    request: components["schemas"]["DepartmentPerformanceTargetImportRequest"],
  ): Promise<components["schemas"]["PerformanceTargetImportResponse"]>;
  updateDepartmentPerformanceTarget(
    targetId: number,
    request: components["schemas"]["DepartmentPerformanceTargetUpdateRequest"],
  ): Promise<components["schemas"]["DepartmentPerformanceTargetResponse"]>;
  deleteDepartmentPerformanceTarget(targetId: number, version: number): Promise<void>;
  getCoreReport(): Promise<components["schemas"]["CoreReportResponse"]>;
  getReportTrend(
    request: components["schemas"]["ReportTrendRequest"],
  ): Promise<components["schemas"]["ReportTrendResponse"]>;
  getReportRanking(
    request: components["schemas"]["ReportRankingRequest"],
  ): Promise<components["schemas"]["ReportRankingResponse"]>;
  getReportCatalog(objectType?: string): Promise<components["schemas"]["ReportCatalogResponse"]>;
  getReportDefinitions(
    request: components["schemas"]["ReportDefinitionQueryRequest"],
  ): Promise<components["schemas"]["ReportDefinitionPageResponse"]>;
  getReportDefinition(
    definitionId: number,
  ): Promise<components["schemas"]["ReportDefinitionResponse"]>;
  createReportDefinition(
    request: components["schemas"]["ReportDefinitionCreateRequest"],
  ): Promise<components["schemas"]["ReportDefinitionResponse"]>;
  updateReportDefinition(
    definitionId: number,
    request: components["schemas"]["ReportDefinitionUpdateRequest"],
  ): Promise<components["schemas"]["ReportDefinitionResponse"]>;
  deleteReportDefinition(definitionId: number, version: number): Promise<void>;
  runReportDefinition(
    definitionId: number,
    request: components["schemas"]["ReportDefinitionRunRequest"],
  ): Promise<components["schemas"]["ReportDefinitionRunResponse"]>;
  getMarketingFormConfigurationOptions(
    formId?: number,
    targetObjectType?: components["schemas"]["MarketingFormResponse"]["targetObjectType"],
  ): Promise<components["schemas"]["MarketingFormConfigurationOptionsResponse"]>;
  getMarketingForms(
    request: components["schemas"]["MarketingFormQueryRequest"],
  ): Promise<components["schemas"]["MarketingFormPageResponse"]>;
  getMarketingForm(formId: number): Promise<components["schemas"]["MarketingFormResponse"]>;
  createMarketingForm(
    request: components["schemas"]["MarketingFormCreateRequest"],
  ): Promise<components["schemas"]["MarketingFormResponse"]>;
  updateMarketingForm(
    formId: number,
    request: components["schemas"]["MarketingFormUpdateRequest"],
  ): Promise<components["schemas"]["MarketingFormResponse"]>;
  updateMarketingFormStatus(
    formId: number,
    request: components["schemas"]["MarketingFormStatusUpdateRequest"],
  ): Promise<components["schemas"]["MarketingFormResponse"]>;
  deleteMarketingForm(formId: number, version: number): Promise<void>;
  getMarketingActivityConfigurationOptions(): Promise<
    components["schemas"]["MarketingActivityConfigurationOptionsResponse"]
  >;
  getMarketingActivities(
    request: components["schemas"]["MarketingActivityQueryRequest"],
  ): Promise<components["schemas"]["MarketingActivityPageResponse"]>;
  getMarketingActivity(
    activityId: number,
  ): Promise<components["schemas"]["MarketingActivityResponse"]>;
  createMarketingActivity(
    request: components["schemas"]["MarketingActivityCreateRequest"],
  ): Promise<components["schemas"]["MarketingActivityResponse"]>;
  updateMarketingActivity(
    activityId: number,
    request: components["schemas"]["MarketingActivityUpdateRequest"],
  ): Promise<components["schemas"]["MarketingActivityResponse"]>;
  deleteMarketingActivities(
    request: components["schemas"]["MarketingActivityBatchDeleteRequest"],
  ): Promise<void>;
  deleteMarketingActivity(activityId: number, version: number): Promise<void>;
  getMarketingFormSubmissionTrend(
    formId: number,
    request: components["schemas"]["MarketingFormSubmissionTrendRequest"],
  ): Promise<components["schemas"]["MarketingFormSubmissionTrendResponse"]>;
  getMarketingFormSubmissionLinks(
    formId: number,
    request: components["schemas"]["MarketingFormSubmissionQueryRequest"],
  ): Promise<components["schemas"]["MarketingFormSubmissionLinkPageResponse"]>;
  getOaForms(
    request: components["schemas"]["OaFormQueryRequest"],
  ): Promise<components["schemas"]["OaFormPageResponse"]>;
  getOaFormConfigurationOptions(): Promise<
    components["schemas"]["OaFormConfigurationOptionsResponse"]
  >;
  getOaForm(formId: number): Promise<components["schemas"]["OaFormResponse"]>;
  createOaForm(
    request: components["schemas"]["OaFormCreateRequest"],
  ): Promise<components["schemas"]["OaFormResponse"]>;
  updateOaForm(
    formId: number,
    request: components["schemas"]["OaFormUpdateRequest"],
  ): Promise<components["schemas"]["OaFormResponse"]>;
  updateOaFormStatus(
    formId: number,
    request: components["schemas"]["OaFormStatusUpdateRequest"],
  ): Promise<components["schemas"]["OaFormResponse"]>;
  deleteOaForm(formId: number, version: number): Promise<void>;
  getAvailableOaForms(): Promise<components["schemas"]["OaFormResponse"][]>;
  getAvailableOaForm(formId: number): Promise<components["schemas"]["OaFormResponse"]>;
  getOaFormFieldCandidates(
    formId: number,
    fieldCode: string,
    query: OaFormFieldCandidateQuery,
  ): Promise<components["schemas"]["OaFormFieldCandidatePageResponse"]>;
  getOaFormApprovalSelectionCandidates(
    formId: number,
    selectionCode: string,
    query: OaFormApprovalSelectionCandidateQuery,
  ): Promise<components["schemas"]["ApprovalSelectionCandidatePageResponse"]>;
  createOaFileFieldDraft(
    formId: number,
    formVersion: number,
  ): Promise<components["schemas"]["FileFieldDraftResponse"]>;
  createCrmFileFieldDraft(
    objectType: CrmFileFieldObjectType,
  ): Promise<components["schemas"]["FileFieldDraftResponse"]>;
  uploadOaFileFieldFiles(
    draft: components["schemas"]["FileFieldDraftResponse"],
    fieldCode: string,
    files: readonly File[],
  ): Promise<OaFileFieldUploadResult>;
  uploadCrmFileFieldFiles(
    draft: components["schemas"]["FileFieldDraftResponse"],
    fieldCode: string,
    files: readonly File[],
  ): Promise<CrmFileFieldUploadResult>;
  uploadExistingCrmFileFieldFiles(
    target: ControlledAttachmentTarget,
    fieldCode: string,
    files: readonly File[],
  ): Promise<ExistingCrmFileFieldUploadResult>;
  getOaFileFieldUploadStatus(
    draftId: number,
    fieldCode: string,
    fileId: number,
  ): Promise<components["schemas"]["FileFieldUploadedFileResponse"]>;
  withdrawFileFieldDraft(draftId: number, version: number): Promise<void>;
  getOaRequests(
    request: components["schemas"]["OaRequestQueryRequest"],
  ): Promise<components["schemas"]["OaRequestPageResponse"]>;
  getOaRequest(requestId: number): Promise<components["schemas"]["OaRequestResponse"]>;
  downloadOaRequestFileField(
    request: OaRequestFileFieldDownloadRequest,
  ): Promise<ControlledDownload>;
  previewOaRequest(
    request: components["schemas"]["OaRequestPreviewRequest"],
  ): Promise<components["schemas"]["OaRequestPreviewResponse"]>;
  submitOaRequest(
    request: components["schemas"]["OaRequestSubmitRequest"],
  ): Promise<components["schemas"]["OaRequestResponse"]>;
  getOaAnnouncements(
    request: components["schemas"]["OaAnnouncementQueryRequest"],
  ): Promise<components["schemas"]["OaAnnouncementPageResponse"]>;
  getOaAnnouncement(
    announcementId: number,
  ): Promise<components["schemas"]["OaAnnouncementResponse"]>;
  getOaAnnouncementAudienceCandidates(
    query: OaAnnouncementAudienceCandidateQuery,
  ): Promise<components["schemas"]["OaAnnouncementAudienceCandidatePageResponse"]>;
  createOaAnnouncement(
    request: components["schemas"]["OaAnnouncementCreateRequest"],
  ): Promise<components["schemas"]["OaAnnouncementResponse"]>;
  updateOaAnnouncement(
    announcementId: number,
    request: components["schemas"]["OaAnnouncementUpdateRequest"],
  ): Promise<components["schemas"]["OaAnnouncementResponse"]>;
  deleteOaAnnouncement(announcementId: number, version: number): Promise<void>;
  publishOaAnnouncement(
    announcementId: number,
    request: components["schemas"]["OaAnnouncementVersionRequest"],
  ): Promise<void>;
  scheduleOaAnnouncement(
    announcementId: number,
    request: components["schemas"]["OaAnnouncementScheduleRequest"],
  ): Promise<void>;
  cancelOaAnnouncementSchedule(
    announcementId: number,
    request: components["schemas"]["OaAnnouncementVersionRequest"],
  ): Promise<void>;
  withdrawOaAnnouncement(
    announcementId: number,
    request: components["schemas"]["OaAnnouncementVersionRequest"],
  ): Promise<void>;
  getMyOaAnnouncementUnreadCount(): Promise<
    components["schemas"]["OaAnnouncementUnreadCountResponse"]
  >;
  getMyOaAnnouncements(
    request: components["schemas"]["QueryRequest"],
  ): Promise<components["schemas"]["OaAnnouncementInboxPageResponse"]>;
  getMyOaAnnouncement(
    announcementId: number,
  ): Promise<components["schemas"]["OaAnnouncementInboxResponse"]>;
  markMyOaAnnouncementRead(
    announcementId: number,
  ): Promise<components["schemas"]["OaAnnouncementReadReceiptResponse"]>;
  getNotificationPreference(): Promise<NotificationPreference>;
  updateNotificationPreference(
    request: components["schemas"]["NotificationPreferenceUpdateRequest"],
  ): Promise<NotificationPreference>;
  getNotifications(
    query: components["schemas"]["NotificationQueryRequest"],
  ): Promise<components["schemas"]["NotificationPageResponse"]>;
  markNotificationRead(notificationId: number): Promise<NotificationInboxItem>;
  getApprovalPendingCount(): Promise<number>;
  getPendingApprovals(
    query: Pick<components["schemas"]["ApprovalQueryRequest"], "page" | "size">,
  ): Promise<ApprovalPendingPage>;
  getApprovalPendingDetail(instanceId: number): Promise<ApprovalPendingDetail>;
  getApprovalTransferCandidates(
    instanceId: number,
    query: ApprovalTransferCandidateQuery,
  ): Promise<ApprovalTransferCandidatePage>;
  actOnApproval(
    instanceId: number,
    request: components["schemas"]["ApprovalActionRequest"],
  ): Promise<ApprovalPendingDetail>;
  withdrawApproval(instanceId: number, version: number): Promise<ApprovalPendingDetail>;
  cancelApproval(instanceId: number, version: number): Promise<ApprovalPendingDetail>;
  batchActOnApprovals(
    request: components["schemas"]["ApprovalBatchActionRequest"],
  ): Promise<ApprovalBatchActionResult>;
  getApprovalStartOptions(objectType: string, subjectId: number): Promise<ApprovalStartOptions>;
  getApprovalStartSelectionCandidates(
    objectType: string,
    subjectId: number,
    definitionId: number,
    selectionCode: string,
    query: ApprovalStartSelectionCandidateQuery,
  ): Promise<ApprovalStartCandidatePage>;
  previewApprovalRoute(
    definitionId: number,
    request: components["schemas"]["ApprovalPreviewRequest"],
  ): Promise<ApprovalRoutePreview>;
  submitApproval(
    request: components["schemas"]["ApprovalSubmitRequest"],
  ): Promise<ApprovalPendingDetail>;
  getStageWorkflows(
    query: Pick<components["schemas"]["StageWorkflowQueryRequest"], "page" | "size">,
  ): Promise<StageWorkflowSummaryPage>;
  getStageWorkflow(workflowId: number): Promise<StageWorkflowDefinitionDetail>;
  getStageWorkflowEditableBaseline(workflowId: number): Promise<StageWorkflowEditableBaseline>;
  getStageWorkflowConfigurationOptions(
    objectType?: StageWorkflowObjectType,
  ): Promise<StageWorkflowConfigurationOptions>;
  getStageWorkflowConfigurationCandidates(
    candidateType: StageWorkflowConfigurationCandidateType,
    query: StageWorkflowConfigurationCandidateQuery,
  ): Promise<StageWorkflowConfigurationCandidatePage>;
  createStageWorkflow(
    request: components["schemas"]["StageWorkflowRequest"],
  ): Promise<StageWorkflowMutationResult>;
  updateStageWorkflow(
    workflowId: number,
    request: components["schemas"]["StageWorkflowRequest"],
  ): Promise<StageWorkflowMutationResult>;
  updateStageWorkflowStatus(
    workflowId: number,
    request: components["schemas"]["StageWorkflowStatusRequest"],
  ): Promise<StageWorkflowMutationResult>;
  getApplicableStageWorkflows(
    objectType: string,
    recordId: number,
  ): Promise<StageWorkflowApplicableOptions>;
  startStageWorkflow(workflowId: number, recordId: number): Promise<StageWorkflowRecord>;
  getStageWorkflowRecord(workflowRecordId: number): Promise<StageWorkflowRecord>;
  getStageWorkflowComments(
    workflowRecordId: number,
    query: StageWorkflowCommentQuery,
  ): Promise<StageWorkflowCommentPage>;
  createStageWorkflowComment(
    workflowRecordId: number,
    request: components["schemas"]["StageCommentCreateRequest"],
  ): Promise<StageWorkflowComment>;
  deleteStageWorkflowComment(
    workflowRecordId: number,
    commentId: number,
    version: number,
  ): Promise<void>;
  getStageWorkflowAdvanceSelectionCandidates(
    workflowRecordId: number,
    selectionCode: string,
    query: StageWorkflowAdvanceSelectionCandidateQuery,
  ): Promise<ApprovalStartCandidatePage>;
  getStageWorkflowFieldCandidates(
    workflowRecordId: number,
    fieldCode: string,
    query: StageWorkflowAdvanceSelectionCandidateQuery,
  ): Promise<StageWorkflowFieldCandidatePage>;
  getStageWorkflowFileUploadStatus(
    draftId: number,
    fieldCode: string,
    fileId: number,
  ): Promise<StageWorkflowUploadedFile>;
  uploadStageWorkflowFiles(
    workflowRecordId: number,
    fieldCode: string,
    files: readonly File[],
  ): Promise<StageWorkflowFileUploadResult>;
  advanceStageWorkflow(
    workflowRecordId: number,
    request: Pick<
      components["schemas"]["StageAdvanceRequest"],
      | "actorFieldValues"
      | "addressFieldValues"
      | "completedTaskCodes"
      | "departmentFieldValues"
      | "fileFieldDraftId"
      | "fileFields"
      | "fieldValues"
      | "relationFieldValues"
      | "selectedApprovers"
      | "version"
    >,
  ): Promise<StageWorkflowRecord>;
  finishStageWorkflow(
    workflowRecordId: number,
    request: components["schemas"]["StageOutcomeRequest"],
  ): Promise<StageWorkflowRecord>;
  getApprovalDefinitions(
    query: Pick<components["schemas"]["ApprovalDefinitionQueryRequest"], "page" | "size">,
  ): Promise<ApprovalDefinitionPage>;
  createApprovalDefinition(
    request: components["schemas"]["ApprovalDefinitionRequest"],
  ): Promise<ApprovalDefinitionListItem>;
  getApprovalDefinitionStatus(definitionId: number): Promise<ApprovalDefinitionStatusBaseline>;
  updateApprovalDefinitionStatus(
    definitionId: number,
    request: components["schemas"]["ApprovalDefinitionStatusRequest"],
  ): Promise<ApprovalDefinitionStatusBaseline>;
  getApprovalDefinitionEditableBaseline(
    definitionId: number,
  ): Promise<ApprovalDefinitionEditableBaseline>;
  updateApprovalDefinition(
    definitionId: number,
    request: components["schemas"]["ApprovalDefinitionRequest"],
  ): Promise<ApprovalDefinitionEditableBaseline>;
  getActivities(
    query: components["schemas"]["ActivityQueryRequest"],
  ): Promise<components["schemas"]["ActivityPageResponse"]>;
  getReturnVisits(
    query: components["schemas"]["ReturnVisitQueryRequest"],
  ): Promise<components["schemas"]["ReturnVisitPageResponse"]>;
  getReturnVisit(returnVisitId: number): Promise<ReturnVisitDetail>;
  createReturnVisit(
    request: components["schemas"]["ReturnVisitCreateRequest"],
  ): Promise<ReturnVisitDetail>;
  updateReturnVisit(
    returnVisitId: number,
    request: components["schemas"]["ReturnVisitUpdateRequest"],
  ): Promise<ReturnVisitDetail>;
  updateReturnVisitOwner(
    returnVisitId: number,
    request: components["schemas"]["ReturnVisitOwnerUpdateRequest"],
  ): Promise<ReturnVisitDetail>;
  deleteReturnVisit(returnVisitId: number, version: number): Promise<void>;
  getActivityMethods(): Promise<readonly ActivityMethodOption[]>;
  getActivity(activityId: number): Promise<ActivityDetail>;
  createActivity(request: components["schemas"]["ActivityCreateRequest"]): Promise<void>;
  createActivitiesBatch(requests: components["schemas"]["ActivityCreateRequest"][]): Promise<void>;
  updateActivity(
    activityId: number,
    request: components["schemas"]["ActivityUpdateRequest"],
  ): Promise<ActivityDetail>;
  deleteActivity(activityId: number, version: number): Promise<void>;
  getCustomers(
    query: components["schemas"]["CustomerQueryRequest"],
  ): Promise<components["schemas"]["CustomerPageResponse"]>;
  getNearbyCustomers(query: CustomerNearbyQuery): Promise<components["schemas"]["Pager"]>;
  getVisibleCustomers(
    query: components["schemas"]["CustomerQueryRequest"],
  ): Promise<readonly CustomerOption[]>;
  getLeads(
    query: components["schemas"]["LeadQueryRequest"],
  ): Promise<components["schemas"]["LeadPageResponse"]>;
  getOpportunities(
    query: components["schemas"]["OpportunityQueryRequest"],
  ): Promise<components["schemas"]["OpportunityPageResponse"]>;
  getOpportunitySummary(
    query: components["schemas"]["OpportunityQueryRequest"],
  ): Promise<OpportunitySummary>;
  getVisibleOpportunities(
    query: Pick<components["schemas"]["OpportunityQueryRequest"], "keyword" | "page" | "size">,
  ): Promise<readonly OpportunityOption[]>;
  getProducts(
    query: components["schemas"]["ProductQueryRequest"],
  ): Promise<components["schemas"]["ProductPageResponse"]>;
  exportProductsCsv(
    request: components["schemas"]["ProductCsvExportRequest"],
  ): Promise<ControlledDownload>;
  getProduct(productId: number): Promise<ProductDetail>;
  getProductEditableBaseline(productId: number): Promise<ProductEditableBaseline>;
  createProduct(request: components["schemas"]["ProductCreateRequest"]): Promise<ProductDetail>;
  createProductImageDraft(): Promise<components["schemas"]["ProductImageDraftResponse"]>;
  uploadProductImageDraftFiles(
    draft: components["schemas"]["ProductImageDraftResponse"],
    imageType: ProductImageType,
    files: readonly File[],
  ): Promise<ProductImageDraftUploadResult>;
  getProductImageDraftUploadStatus(
    draftId: number,
    imageType: ProductImageType,
    fileId: number,
  ): Promise<components["schemas"]["ProductImageUploadStatusResponse"]>;
  withdrawProductImageDraft(draftId: number, version: number): Promise<void>;
  updateProduct(
    productId: number,
    request: components["schemas"]["ProductUpdateRequest"],
  ): Promise<ProductDetail>;
  updateProductAvailability(
    productId: number,
    request: components["schemas"]["ProductAvailabilityUpdateRequest"],
  ): Promise<ProductDetail>;
  updateProductOwner(
    productId: number,
    request: components["schemas"]["ProductOwnerUpdateRequest"],
  ): Promise<ProductDetail>;
  deleteProduct(productId: number, version: number): Promise<void>;
  getProductCategories(): Promise<readonly ProductCategory[]>;
  createProductCategory(
    request: components["schemas"]["ProductCategoryCreateRequest"],
  ): Promise<ProductCategory>;
  updateProductCategory(
    categoryId: number,
    request: components["schemas"]["ProductCategoryUpdateRequest"],
  ): Promise<ProductCategory>;
  deleteProductCategory(categoryId: number, version: number): Promise<void>;
  getOpportunity(opportunityId: number): Promise<OpportunityDetail>;
  getOpportunityEditableBaseline(opportunityId: number): Promise<OpportunityEditableBaseline>;
  getOpportunityCollaboratorBaseline(
    opportunityId: number,
  ): Promise<OpportunityCollaboratorBaseline>;
  getOpportunityContactsBaseline(opportunityId: number): Promise<OpportunityContactsBaseline>;
  getVisibleOpportunity(opportunityId: number): Promise<OpportunityOption>;
  getOpportunityContacts(opportunityId: number): Promise<readonly OpportunityContact[]>;
  getOpportunityProducts(opportunityId: number): Promise<OpportunityProductSnapshot>;
  getOpportunityProductBaseline(opportunityId: number): Promise<OpportunityProductBaseline>;
  createOpportunity(
    request: components["schemas"]["OpportunityCreateRequest"],
  ): Promise<OpportunityDetail>;
  updateOpportunity(
    opportunityId: number,
    request: components["schemas"]["OpportunityUpdateRequest"],
  ): Promise<OpportunityDetail>;
  replaceOpportunityCollaborators(
    opportunityId: number,
    request: components["schemas"]["OpportunityCollaboratorsUpdateRequest"],
  ): Promise<OpportunityDetail>;
  replaceOpportunityContacts(
    opportunityId: number,
    request: components["schemas"]["OpportunityContactsUpdateRequest"],
  ): Promise<OpportunityDetail>;
  replaceOpportunityProducts(
    opportunityId: number,
    request: components["schemas"]["OpportunityProductsUpdateRequest"],
  ): Promise<OpportunityProductBaseline>;
  exitOpportunityCollaborator(opportunityId: number, version: number): Promise<void>;
  setOpportunityStarred(
    opportunityId: number,
    request: components["schemas"]["OpportunityStarUpdateRequest"],
  ): Promise<void>;
  updateOpportunityStage(
    opportunityId: number,
    request: components["schemas"]["OpportunityStageUpdateRequest"],
  ): Promise<OpportunityDetail>;
  updateOpportunityOutcome(
    opportunityId: number,
    request: components["schemas"]["OpportunityOutcomeUpdateRequest"],
  ): Promise<OpportunityDetail>;
  updateOpportunityOwner(
    opportunityId: number,
    request: components["schemas"]["OpportunityOwnerUpdateRequest"],
  ): Promise<OpportunityDetail>;
  updateOpportunityOwners(
    request: components["schemas"]["OpportunityBatchOwnerUpdateRequest"],
  ): Promise<void>;
  updateOpportunityPrimaryContact(
    opportunityId: number,
    request: components["schemas"]["OpportunityPrimaryContactUpdateRequest"],
  ): Promise<OpportunityDetail>;
  deleteOpportunity(opportunityId: number, version: number): Promise<void>;
  deleteOpportunities(
    request: components["schemas"]["OpportunityBatchDeleteRequest"],
  ): Promise<void>;
  getOpportunityPipelines(
    query: components["schemas"]["OpportunityPipelineQueryRequest"],
  ): Promise<readonly OpportunityPipelineOption[]>;
  getOpportunityPipelineStages(
    pipelineId: number,
    query: components["schemas"]["OpportunityPipelineStageQueryRequest"],
  ): Promise<readonly OpportunityPipelineStageOption[]>;
  queryOpportunityPipelineCatalog(
    query: components["schemas"]["OpportunityPipelineQueryRequest"],
  ): Promise<components["schemas"]["OpportunityPipelinePageResponse"]>;
  createOpportunityPipeline(
    request: components["schemas"]["OpportunityPipelineCreateRequest"],
  ): Promise<OpportunityPipelineCatalogItem>;
  updateOpportunityPipeline(
    pipelineId: number,
    request: components["schemas"]["OpportunityPipelineUpdateRequest"],
  ): Promise<OpportunityPipelineCatalogItem>;
  updateOpportunityPipelineStatus(
    pipelineId: number,
    request: components["schemas"]["OpportunityPipelineStatusUpdateRequest"],
  ): Promise<OpportunityPipelineCatalogItem>;
  deleteOpportunityPipeline(pipelineId: number, version: number): Promise<void>;
  queryOpportunityPipelineStagesCatalog(
    pipelineId: number,
    query: components["schemas"]["OpportunityPipelineStageQueryRequest"],
  ): Promise<components["schemas"]["OpportunityPipelineStagePageResponse"]>;
  createOpportunityPipelineStage(
    pipelineId: number,
    request: components["schemas"]["OpportunityPipelineStageCreateRequest"],
  ): Promise<OpportunityPipelineStageCatalogItem>;
  updateOpportunityPipelineStage(
    pipelineId: number,
    stageId: number,
    request: components["schemas"]["OpportunityPipelineStageUpdateRequest"],
  ): Promise<OpportunityPipelineStageCatalogItem>;
  updateOpportunityPipelineStageStatus(
    pipelineId: number,
    stageId: number,
    request: components["schemas"]["OpportunityPipelineStageStatusUpdateRequest"],
  ): Promise<OpportunityPipelineStageCatalogItem>;
  deleteOpportunityPipelineStage(
    pipelineId: number,
    stageId: number,
    version: number,
  ): Promise<void>;
  getNearbyLeads(query: LeadNearbyQuery): Promise<components["schemas"]["Pager"]>;
  getLead(leadId: number): Promise<LeadDetail>;
  getLeadTagCatalog(): Promise<readonly string[]>;
  getLeadCollaboratorBaseline(leadId: number): Promise<LeadCollaboratorBaseline>;
  getLeadHierarchy(leadId: number): Promise<LeadHierarchy>;
  exportLeadsCsv(
    request: components["schemas"]["LeadCsvExportRequest"],
  ): Promise<ControlledDownload>;
  createLead(request: components["schemas"]["LeadCreateRequest"]): Promise<LeadDetail>;
  convertLead(
    leadId: number,
    request: components["schemas"]["LeadConvertRequest"],
  ): Promise<LeadConversion>;
  checkLeadDuplicate(request: components["schemas"]["LeadDuplicateCheckRequest"]): Promise<boolean>;
  setLeadStarred(
    leadId: number,
    request: components["schemas"]["LeadStarUpdateRequest"],
  ): Promise<void>;
  updateLeadState(
    leadId: number,
    request: components["schemas"]["LeadStateUpdateRequest"],
  ): Promise<LeadDetail>;
  replaceLeadTags(
    leadId: number,
    request: components["schemas"]["LeadTagsUpdateRequest"],
  ): Promise<LeadDetail>;
  changeLeadTags(request: components["schemas"]["LeadBatchTagRequest"]): Promise<void>;
  updateLeadOwners(request: components["schemas"]["LeadBatchOwnerUpdateRequest"]): Promise<void>;
  deleteLeads(request: components["schemas"]["LeadBatchDeleteRequest"]): Promise<void>;
  updateLead(
    leadId: number,
    request: components["schemas"]["LeadUpdateRequest"],
  ): Promise<LeadDetail>;
  updateLeadOwner(
    leadId: number,
    request: components["schemas"]["LeadOwnerUpdateRequest"],
  ): Promise<LeadDetail>;
  updateLeadParent(
    leadId: number,
    request: components["schemas"]["LeadParentUpdateRequest"],
  ): Promise<LeadDetail>;
  replaceLeadCollaborators(
    leadId: number,
    request: components["schemas"]["LeadCollaboratorsUpdateRequest"],
  ): Promise<LeadDetail>;
  exitLeadCollaborator(leadId: number, version: number): Promise<void>;
  deleteLead(leadId: number, version: number): Promise<void>;
  getContacts(
    query: components["schemas"]["ContactQueryRequest"],
  ): Promise<components["schemas"]["ContactPageResponse"]>;
  getNearbyContacts(query: ContactNearbyQuery): Promise<components["schemas"]["Pager"]>;
  getContracts(
    query: components["schemas"]["ContractQueryRequest"],
  ): Promise<components["schemas"]["ContractPageResponse"]>;
  getContractSummary(
    query: components["schemas"]["ContractQueryRequest"],
  ): Promise<components["schemas"]["ContractListSummaryResponse"]>;
  getVisibleContracts(
    query: Pick<components["schemas"]["ContractQueryRequest"], "keyword" | "page" | "size">,
  ): Promise<readonly ContractOption[]>;
  getVisibleContract(contractId: number): Promise<ContractOption>;
  getContract(contractId: number): Promise<ContractDetail>;
  getContractCollaboratorBaseline(contractId: number): Promise<ContractCollaboratorBaseline>;
  getContractProductBaseline(contractId: number): Promise<ContractProductBaseline>;
  createContract(request: components["schemas"]["ContractCreateRequest"]): Promise<ContractDetail>;
  updateContract(
    contractId: number,
    request: components["schemas"]["ContractUpdateRequest"],
  ): Promise<ContractDetail>;
  replaceContractProducts(
    contractId: number,
    request: components["schemas"]["ContractProductsUpdateRequest"],
  ): Promise<ContractProductBaseline>;
  deleteContract(contractId: number, version: number): Promise<void>;
  exportSelectedContractsCsv(
    request: components["schemas"]["ContractBatchCsvExportRequest"],
  ): Promise<ControlledDownload>;
  updateContractOwners(
    request: components["schemas"]["ContractBatchOwnerUpdateRequest"],
  ): Promise<void>;
  deleteContracts(request: components["schemas"]["ContractBatchDeleteRequest"]): Promise<void>;
  addContractCollaborators(
    request: components["schemas"]["ContractBatchCollaboratorAddRequest"],
  ): Promise<void>;
  removeContractCollaborators(
    request: components["schemas"]["ContractBatchCollaboratorRemoveRequest"],
  ): Promise<void>;
  voidContract(contractId: number, version: number): Promise<void>;
  updateContractOwner(
    contractId: number,
    request: components["schemas"]["ContractOwnerUpdateRequest"],
  ): Promise<ContractDetail>;
  replaceContractCollaborators(
    contractId: number,
    request: components["schemas"]["ContractCollaboratorsUpdateRequest"],
  ): Promise<ContractDetail>;
  exitContractCollaborator(contractId: number, version: number): Promise<void>;
  getInvoiceProfiles(customerId: number): Promise<readonly InvoiceProfileListItem[]>;
  getInvoices(
    query: components["schemas"]["InvoiceQueryRequest"],
  ): Promise<components["schemas"]["InvoicePageResponse"]>;
  getInvoice(invoiceId: number): Promise<InvoiceListItem>;
  createInvoice(request: components["schemas"]["InvoiceCreateRequest"]): Promise<InvoiceListItem>;
  updateInvoice(
    invoiceId: number,
    request: components["schemas"]["InvoiceUpdateRequest"],
  ): Promise<InvoiceListItem>;
  issueInvoice(
    invoiceId: number,
    request: components["schemas"]["InvoiceIssueRequest"],
  ): Promise<InvoiceListItem>;
  deleteInvoice(invoiceId: number, version: number): Promise<void>;
  deleteInvoices(request: components["schemas"]["InvoiceBatchDeleteRequest"]): Promise<void>;
  resetInvoice(invoiceId: number, version: number): Promise<void>;
  resetInvoices(request: components["schemas"]["InvoiceBatchResetRequest"]): Promise<void>;
  updateInvoiceOwner(
    invoiceId: number,
    request: components["schemas"]["InvoiceOwnerUpdateRequest"],
  ): Promise<InvoiceListItem>;
  updateInvoiceOwners(
    request: components["schemas"]["InvoiceBatchOwnerUpdateRequest"],
  ): Promise<void>;
  getReceivables(
    query: components["schemas"]["ReceivableQueryRequest"],
  ): Promise<components["schemas"]["ReceivablePageResponse"]>;
  getReceivableSummary(
    query: components["schemas"]["ReceivableQueryRequest"],
  ): Promise<components["schemas"]["ReceivableListSummaryResponse"]>;
  getReceivable(receivableId: number): Promise<ReceivableListItem>;
  createReceivable(
    request: components["schemas"]["ReceivableCreateRequest"],
  ): Promise<ReceivableListItem>;
  updateReceivable(
    receivableId: number,
    request: components["schemas"]["ReceivableUpdateRequest"],
  ): Promise<ReceivableListItem>;
  updateReceivableOwner(
    receivableId: number,
    request: components["schemas"]["ReceivableOwnerUpdateRequest"],
  ): Promise<ReceivableListItem>;
  updateReceivableOwners(
    request: components["schemas"]["ReceivableBatchOwnerUpdateRequest"],
  ): Promise<void>;
  deleteReceivable(receivableId: number, version: number): Promise<void>;
  deleteReceivables(request: components["schemas"]["ReceivableBatchDeleteRequest"]): Promise<void>;
  getReceivablePlans(
    query: components["schemas"]["ReceivablePlanQueryRequest"],
  ): Promise<components["schemas"]["ReceivablePlanPageResponse"]>;
  getReceivablePlanSummary(
    query: components["schemas"]["ReceivablePlanQueryRequest"],
  ): Promise<components["schemas"]["ReceivablePlanListSummaryResponse"]>;
  exportReceivablePlansCsv(
    request: components["schemas"]["ReceivablePlanCsvExportRequest"],
  ): Promise<ControlledDownload>;
  getVisibleReceivablePlans(
    query: Pick<components["schemas"]["ReceivablePlanQueryRequest"], "keyword" | "page" | "size">,
  ): Promise<readonly ReceivablePlanOption[]>;
  getReceivablePlan(planId: number): Promise<ReceivablePlanListItem>;
  getVisibleReceivablePlan(planId: number): Promise<ReceivablePlanOption>;
  getWorkTasks(
    query: components["schemas"]["WorkTaskQueryRequest"],
  ): Promise<components["schemas"]["WorkTaskPageResponse"]>;
  getWorklist(
    query: NonNullable<paths["/api/v1/worklist"]["get"]>["parameters"]["query"],
  ): Promise<WorklistPage>;
  acknowledgeWorklist(
    request: components["schemas"]["WorklistAcknowledgementRequest"],
  ): Promise<void>;
  getWorkTaskSeries(query: {
    page: number;
    size: number;
  }): Promise<components["schemas"]["WorkTaskSeriesListPageResponse"]>;
  getWorkTaskSeriesDetail(seriesId: number): Promise<WorkTaskSeriesDetail>;
  createWorkTaskSeries(
    request: components["schemas"]["WorkTaskSeriesCreateRequest"],
  ): Promise<WorkTaskSeriesMutationResult>;
  updateWorkTaskSeries(
    seriesId: number,
    request: components["schemas"]["WorkTaskSeriesUpdateRequest"],
  ): Promise<WorkTaskSeriesMutationResult>;
  activateWorkTaskSeries(seriesId: number, version: number): Promise<WorkTaskSeriesMutationResult>;
  pauseWorkTaskSeries(seriesId: number, version: number): Promise<WorkTaskSeriesMutationResult>;
  deleteWorkTaskSeries(seriesId: number, version: number): Promise<WorkTaskSeriesMutationResult>;
  getWorkTaskSeriesOccurrences(
    seriesId: number,
    query: { page: number; size: number },
  ): Promise<components["schemas"]["WorkTaskSeriesOccurrencePageResponse"]>;
  getWorkTaskSeriesReminderPlan(seriesId: number): Promise<WorkTaskSeriesReminderPlan>;
  getWorkTask(taskId: number): Promise<WorkTaskListItem>;
  getWorkTaskEditBaseline(taskId: number): Promise<WorkTaskEditBaseline>;
  getWorkTaskFollowerBaseline(taskId: number): Promise<WorkTaskFollowerBaseline>;
  getWorkTaskReminderPlan(taskId: number): Promise<WorkTaskReminderPlan>;
  getWorkTaskAttachments(
    taskId: number,
    query: { page: number; size: number },
  ): Promise<components["schemas"]["AttachmentPageResponse"]>;
  createWorkTask(
    request: components["schemas"]["WorkTaskCreateRequest"],
  ): Promise<WorkTaskListItem>;
  updateWorkTask(
    taskId: number,
    request: components["schemas"]["WorkTaskUpdateRequest"],
  ): Promise<WorkTaskListItem>;
  updateWorkTaskAssignee(
    taskId: number,
    request: components["schemas"]["WorkTaskAssigneeUpdateRequest"],
  ): Promise<WorkTaskListItem>;
  replaceWorkTaskFollowers(
    taskId: number,
    request: components["schemas"]["WorkTaskFollowerUpdateRequest"],
  ): Promise<WorkTaskListItem>;
  replaceWorkTaskReminderPlan(
    taskId: number,
    request: components["schemas"]["WorkTaskReminderPlanUpdateRequest"],
  ): Promise<WorkTaskReminderPlan>;
  replaceWorkTaskSeriesReminderPlan(
    seriesId: number,
    request: components["schemas"]["WorkTaskReminderPlanUpdateRequest"],
  ): Promise<WorkTaskSeriesReminderPlan>;
  updateWorkTaskBusinessRecord(
    taskId: number,
    request: components["schemas"]["WorkTaskBusinessRecordUpdateRequest"],
  ): Promise<WorkTaskListItem>;
  clearWorkTaskBusinessRecord(
    taskId: number,
    request: components["schemas"]["WorkTaskBusinessRecordUpdateRequest"],
  ): Promise<WorkTaskListItem>;
  startWorkTask(
    taskId: number,
    request: components["schemas"]["WorkTaskVersionRequest"],
  ): Promise<WorkTaskListItem>;
  returnWorkTaskToTodo(
    taskId: number,
    request: components["schemas"]["WorkTaskVersionRequest"],
  ): Promise<WorkTaskListItem>;
  completeWorkTask(
    taskId: number,
    request: components["schemas"]["WorkTaskVersionRequest"],
  ): Promise<WorkTaskListItem>;
  cancelWorkTask(
    taskId: number,
    request: components["schemas"]["WorkTaskVersionRequest"],
  ): Promise<WorkTaskListItem>;
  deleteWorkTask(taskId: number, version: number): Promise<void>;
  getWorkTaskComments(
    taskId: number,
    query: { page: number; size: number },
  ): Promise<components["schemas"]["WorkTaskCommentPageResponse"]>;
  createWorkTaskComment(
    taskId: number,
    request: components["schemas"]["WorkTaskCommentCreateRequest"],
  ): Promise<WorkTaskCommentListItem>;
  getAvailableReceivablePlans(contractId: number): Promise<readonly ReceivablePlanSelectionItem[]>;
  createReceivablePlan(
    request: components["schemas"]["ReceivablePlanCreateRequest"],
  ): Promise<ReceivablePlanListItem>;
  createReceivablePlansBatch(
    request: components["schemas"]["ReceivablePlanBatchCreateRequest"],
  ): Promise<readonly ReceivablePlanListItem[]>;
  updateReceivablePlan(
    planId: number,
    request: components["schemas"]["ReceivablePlanUpdateRequest"],
  ): Promise<ReceivablePlanListItem>;
  deleteReceivablePlan(planId: number, version: number): Promise<void>;
  createInvoiceProfile(
    request: components["schemas"]["InvoiceProfileRequest"],
  ): Promise<InvoiceProfileListItem>;
  updateInvoiceProfile(
    profileId: number,
    request: components["schemas"]["InvoiceProfileUpdateRequest"],
  ): Promise<InvoiceProfileListItem>;
  deleteInvoiceProfile(profileId: number, version: number): Promise<void>;
  getCustomerPoolCatalog(): Promise<components["schemas"]["CustomerPoolResponse"][]>;
  getCustomerPoolConfigurations(
    query: CustomerPoolConfigurationQuery,
  ): Promise<components["schemas"]["CustomerPoolPageResponse"]>;
  createCustomerPool(
    request: components["schemas"]["CustomerPoolCreateRequest"],
  ): Promise<components["schemas"]["CustomerPoolResponse"]>;
  updateCustomerPool(
    poolId: number,
    request: components["schemas"]["CustomerPoolUpdateRequest"],
  ): Promise<components["schemas"]["CustomerPoolResponse"]>;
  updateCustomerPoolStatus(
    poolId: number,
    request: components["schemas"]["CustomerPoolStatusUpdateRequest"],
  ): Promise<components["schemas"]["CustomerPoolResponse"]>;
  transferCustomerPool(
    poolId: number,
    request: components["schemas"]["CustomerPoolTransferRequest"],
  ): Promise<void>;
  deleteCustomerPool(poolId: number, version: number): Promise<void>;
  getCustomerPoolCustomers(
    poolId: number,
    query: components["schemas"]["CustomerPoolCustomerQueryRequest"],
  ): Promise<components["schemas"]["CustomerPoolCustomerPageResponse"]>;
  releaseCustomerToPool(
    poolId: number,
    request: components["schemas"]["CustomerPoolCustomerBatchRequest"],
  ): Promise<components["schemas"]["CustomerResponse"][]>;
  claimCustomerFromPool(
    poolId: number,
    request: components["schemas"]["CustomerPoolCustomerBatchRequest"],
  ): Promise<components["schemas"]["CustomerResponse"][]>;
  assignCustomerFromPool(
    poolId: number,
    request: components["schemas"]["CustomerPoolAssignRequest"],
  ): Promise<components["schemas"]["CustomerResponse"][]>;
  deleteCustomerFromPool(
    poolId: number,
    request: components["schemas"]["CustomerPoolCustomerBatchRequest"],
  ): Promise<void>;
  getContactPoolCatalog(): Promise<readonly ContactPoolCatalogItem[]>;
  getContactPoolConfigurations(
    query: ContactPoolConfigurationQuery,
  ): Promise<components["schemas"]["Pager"]>;
  createContactPool(request: components["schemas"]["ContactPoolCreateRequest"]): Promise<void>;
  updateContactPool(
    poolId: number,
    request: components["schemas"]["ContactPoolUpdateRequest"],
  ): Promise<void>;
  updateContactPoolStatus(
    poolId: number,
    request: components["schemas"]["ContactPoolStatusUpdateRequest"],
  ): Promise<void>;
  transferContactPool(
    poolId: number,
    request: components["schemas"]["ContactPoolTransferRequest"],
  ): Promise<void>;
  deleteContactPool(poolId: number, version: number): Promise<void>;
  getContactPoolContacts(
    poolId: number,
    query: components["schemas"]["ContactPoolContactQueryRequest"],
  ): Promise<components["schemas"]["Pager"]>;
  releaseContactToPool(
    poolId: number,
    request: components["schemas"]["ContactPoolContactBatchRequest"],
  ): Promise<void>;
  claimContactFromPool(
    poolId: number,
    request: components["schemas"]["ContactPoolContactBatchRequest"],
  ): Promise<void>;
  assignContactFromPool(
    poolId: number,
    request: components["schemas"]["ContactPoolAssignRequest"],
  ): Promise<void>;
  deleteContactFromPool(
    poolId: number,
    request: components["schemas"]["ContactPoolContactBatchRequest"],
  ): Promise<void>;
  getContact(contactId: number): Promise<ContactDetail>;
  getContactTagCatalog(): Promise<readonly string[]>;
  getContactCollaboratorBaseline(contactId: number): Promise<ContactCollaboratorBaseline>;
  getContactHierarchy(contactId: number): Promise<ContactHierarchy>;
  exportContactsCsv(
    request: components["schemas"]["ContactCsvExportRequest"],
  ): Promise<ControlledDownload>;
  checkContactDuplicate(
    request: components["schemas"]["ContactDuplicateCheckRequest"],
  ): Promise<boolean>;
  createContact(request: components["schemas"]["ContactCreateRequest"]): Promise<ContactDetail>;
  updateContact(
    contactId: number,
    request: components["schemas"]["ContactUpdateRequest"],
  ): Promise<ContactDetail>;
  setContactStarred(
    contactId: number,
    request: components["schemas"]["ContactStarUpdateRequest"],
  ): Promise<void>;
  updateContactState(
    contactId: number,
    request: components["schemas"]["ContactStateUpdateRequest"],
  ): Promise<ContactDetail>;
  replaceContactTags(
    contactId: number,
    request: components["schemas"]["ContactTagsUpdateRequest"],
  ): Promise<ContactDetail>;
  changeContactTags(request: components["schemas"]["ContactBatchTagRequest"]): Promise<void>;
  updateContactOwners(
    request: components["schemas"]["ContactBatchOwnerUpdateRequest"],
  ): Promise<void>;
  deleteContacts(request: components["schemas"]["ContactBatchDeleteRequest"]): Promise<void>;
  updateContactParent(
    contactId: number,
    request: components["schemas"]["ContactParentUpdateRequest"],
  ): Promise<ContactDetail>;
  updateContactOwner(
    contactId: number,
    request: components["schemas"]["ContactOwnerUpdateRequest"],
  ): Promise<ContactDetail>;
  replaceContactCollaborators(
    contactId: number,
    request: components["schemas"]["ContactCollaboratorsUpdateRequest"],
  ): Promise<ContactDetail>;
  exitContactCollaborator(contactId: number, version: number): Promise<void>;
  deleteContact(contactId: number, version: number): Promise<void>;
  getCustomer(customerId: number): Promise<CustomerDetail>;
  getCustomerBusinessOverview(customerId: number): Promise<CustomerBusinessOverview>;
  getCustomerCollaboratorBaseline(customerId: number): Promise<CustomerCollaboratorBaseline>;
  getCustomerHierarchy(customerId: number): Promise<CustomerHierarchy>;
  getCustomerTagCatalog(): Promise<readonly string[]>;
  updateMyProfile(
    request: components["schemas"]["MemberProfileUpdateRequest"],
  ): Promise<components["schemas"]["MemberProfileResponse"]>;
  getVisibleMembers(
    query: components["schemas"]["MemberProfileQueryRequest"],
  ): Promise<readonly MemberOption[]>;
  getVisibleDepartments(): Promise<readonly DepartmentOption[]>;
  getOrganizationDepartments(): Promise<components["schemas"]["DepartmentResponse"][]>;
  createOrganizationDepartment(
    request: components["schemas"]["DepartmentCreateRequest"],
  ): Promise<components["schemas"]["DepartmentResponse"]>;
  renameOrganizationDepartment(
    departmentId: number,
    request: components["schemas"]["DepartmentRenameRequest"],
  ): Promise<components["schemas"]["DepartmentResponse"]>;
  moveOrganizationDepartment(
    departmentId: number,
    request: components["schemas"]["DepartmentMoveRequest"],
  ): Promise<components["schemas"]["DepartmentResponse"]>;
  deactivateOrganizationDepartment(departmentId: number): Promise<void>;
  deleteOrganizationDepartment(departmentId: number): Promise<void>;
  getOrganizationMembers(
    request: components["schemas"]["MemberProfileQueryRequest"],
  ): Promise<components["schemas"]["MemberProfilePageResponse"]>;
  getOrganizationDepartmentMembers(
    departmentId: number,
    request: components["schemas"]["DepartmentMemberQueryRequest"],
  ): Promise<components["schemas"]["DepartmentMemberProfilePageResponse"]>;
  getUsers(
    request: components["schemas"]["UserQueryRequest"],
  ): Promise<components["schemas"]["UserPageResponse"]>;
  createUser(
    request: components["schemas"]["UserCreateRequest"],
  ): Promise<components["schemas"]["UserResponse"]>;
  updateUserStatus(
    userId: number,
    status: components["schemas"]["UserResponse"]["status"],
  ): Promise<void>;
  deleteUser(userId: number): Promise<void>;
  submitMembershipRequest(
    request: components["schemas"]["MembershipRequestCreateRequest"],
  ): Promise<components["schemas"]["MembershipRequestResponse"]>;
  withdrawMembershipRequest(requestId: number): Promise<void>;
  getMyMembershipRequests(
    request: components["schemas"]["MembershipRequestQueryRequest"],
  ): Promise<components["schemas"]["MembershipRequestPageResponse"]>;
  getMembershipRequests(
    request: components["schemas"]["MembershipRequestQueryRequest"],
  ): Promise<components["schemas"]["MembershipRequestPageResponse"]>;
  approveMembershipRequest(requestId: number): Promise<void>;
  rejectMembershipRequest(requestId: number): Promise<void>;
  getAuthorizationCapabilities(): Promise<components["schemas"]["AuthorityCapabilityResponse"][]>;
  getTenantRoles(
    request: components["schemas"]["RoleQueryRequest"],
  ): Promise<components["schemas"]["TenantRolePageResponse"]>;
  createTenantRole(
    request: components["schemas"]["RoleCreateRequest"],
  ): Promise<components["schemas"]["TenantRoleResponse"]>;
  updateTenantRole(
    roleId: number,
    request: components["schemas"]["RoleUpdateRequest"],
  ): Promise<components["schemas"]["TenantRoleResponse"]>;
  copyTenantRole(
    roleId: number,
    request: components["schemas"]["RoleCopyRequest"],
  ): Promise<components["schemas"]["TenantRoleResponse"]>;
  replaceTenantRoleGrants(
    roleId: number,
    request: components["schemas"]["RoleGrantReplaceRequest"],
  ): Promise<components["schemas"]["TenantRoleResponse"]>;
  deleteTenantRole(roleId: number, version: number): Promise<void>;
  getTenantRoleAssignments(
    roleId: number,
    request: components["schemas"]["QueryRequest"],
  ): Promise<components["schemas"]["RoleAssignmentPageResponse"]>;
  assignTenantRole(
    roleId: number,
    request: components["schemas"]["RoleAssignmentCreateRequest"],
  ): Promise<void>;
  removeTenantRoleAssignment(roleId: number, actorId: number): Promise<void>;
  getCustomizableBusinessObjects(): Promise<components["schemas"]["BusinessObjectResponse"][]>;
  listFieldDefinitions(
    objectType: string,
    includeInactive: boolean,
  ): Promise<components["schemas"]["FieldDefinitionResponse"][]>;
  createFieldDefinition(
    objectType: string,
    request: components["schemas"]["FieldCreateRequest"],
  ): Promise<components["schemas"]["FieldDefinitionResponse"]>;
  updateFieldDefinition(
    objectType: string,
    fieldId: number,
    request: components["schemas"]["FieldUpdateRequest"],
  ): Promise<components["schemas"]["FieldDefinitionResponse"]>;
  deactivateFieldDefinition(objectType: string, fieldId: number, version: number): Promise<void>;
  getFieldLayoutDefinition(
    objectType: string,
  ): Promise<components["schemas"]["FieldLayoutResponse"]>;
  updateFieldLayoutDefinition(
    objectType: string,
    request: components["schemas"]["FieldLayoutUpdateRequest"],
  ): Promise<components["schemas"]["FieldLayoutResponse"]>;
  getRoleFieldPolicy(
    roleId: number,
    objectType: string,
  ): Promise<components["schemas"]["RoleFieldPolicyResponse"]>;
  replaceRoleFieldPolicy(
    roleId: number,
    objectType: string,
    request: components["schemas"]["RoleFieldPolicyReplaceRequest"],
  ): Promise<components["schemas"]["RoleFieldPolicyResponse"]>;
  listSavedViews(
    objectType: string,
    includeHidden?: boolean,
  ): Promise<components["schemas"]["SavedViewResponse"][]>;
  createSavedView(
    request: components["schemas"]["SavedViewCreateRequest"],
  ): Promise<components["schemas"]["SavedViewResponse"]>;
  updateSavedView(
    viewId: number,
    request: components["schemas"]["SavedViewUpdateRequest"],
  ): Promise<components["schemas"]["SavedViewResponse"]>;
  deleteSavedView(viewId: number, version: number): Promise<void>;
  setDefaultSavedView(
    viewId: number,
    version: number,
  ): Promise<components["schemas"]["SavedViewResponse"]>;
  checkCustomerDuplicate(
    request: components["schemas"]["CustomerDuplicateCheckRequest"],
  ): Promise<boolean>;
  createCustomer(request: components["schemas"]["CustomerCreateRequest"]): Promise<CustomerDetail>;
  updateCustomer(
    customerId: number,
    request: components["schemas"]["CustomerUpdateRequest"],
  ): Promise<CustomerDetail>;
  updateCustomerOwner(
    customerId: number,
    request: components["schemas"]["CustomerOwnerUpdateRequest"],
  ): Promise<CustomerDetail>;
  replaceCustomerCollaborators(
    customerId: number,
    request: components["schemas"]["CustomerCollaboratorsUpdateRequest"],
  ): Promise<CustomerDetail>;
  exitCustomerCollaborator(customerId: number, version: number): Promise<void>;
  updateCustomerParent(
    customerId: number,
    request: components["schemas"]["CustomerParentUpdateRequest"],
  ): Promise<CustomerDetail>;
  updateCustomerState(
    customerId: number,
    request: components["schemas"]["CustomerStateUpdateRequest"],
  ): Promise<CustomerDetail>;
  replaceCustomerTags(
    customerId: number,
    request: components["schemas"]["CustomerTagsUpdateRequest"],
  ): Promise<CustomerDetail>;
  changeCustomerTags(request: components["schemas"]["CustomerBatchTagRequest"]): Promise<void>;
  deleteCustomer(customerId: number, version: number): Promise<void>;
  exportCustomersCsv(
    request: components["schemas"]["CustomerCsvExportRequest"],
  ): Promise<ControlledDownload>;
  setCustomerStarred(
    customerId: number,
    request: components["schemas"]["CustomerStarUpdateRequest"],
  ): Promise<void>;
  getFieldDefinitions(objectType: string): Promise<readonly FieldDefinition[]>;
  getFieldLayout(objectType: string): Promise<FieldLayout>;
  createCrmImportDraft(
    objectType: components["schemas"]["CrmImportDraftCreateRequest"]["objectType"],
  ): Promise<components["schemas"]["CrmImportDraftResponse"]>;
  getCrmImportTemplate(
    objectType: components["schemas"]["CrmImportDraftCreateRequest"]["objectType"],
  ): Promise<components["schemas"]["CrmImportTemplateResponse"]>;
  getCrmImportHistory(
    objectType: components["schemas"]["CrmImportDraftCreateRequest"]["objectType"],
    page?: number,
    size?: number,
  ): Promise<components["schemas"]["CrmImportHistoryPageResponse"]>;
  uploadCrmImportDraftSource(
    draftId: number,
    file: File,
  ): Promise<ControlledAttachmentUploadResult>;
  getCrmImportDraftSourceStatus(
    draftId: number,
    fileId: number,
  ): Promise<components["schemas"]["AttachmentUploadStatusResponse"]>;
  getCrmImportDraftPreview(
    draftId: number,
  ): Promise<components["schemas"]["CrmImportPreviewResponse"]>;
  downloadCrmImportDraftErrorReport(draftId: number): Promise<ControlledDownload>;
  confirmCrmImportDraft(
    draftId: number,
    version: components["schemas"]["CrmImportDraftConfirmRequest"]["version"],
  ): Promise<components["schemas"]["CrmImportConfirmResponse"]>;
  withdrawCrmImportDraft(
    draftId: number,
    version: components["schemas"]["CrmImportDraftConfirmRequest"]["version"],
  ): Promise<void>;
  getAttachments(
    target: ControlledAttachmentTarget,
    query: ControlledAttachmentQuery,
  ): Promise<components["schemas"]["AttachmentPageResponse"]>;
  getAttachmentUploadStatus(
    target: ControlledAttachmentTarget,
    fileId: number,
  ): Promise<components["schemas"]["AttachmentUploadStatusResponse"]>;
  uploadAttachments(
    target: ControlledAttachmentTarget,
    files: readonly File[],
    options?: ControlledAttachmentUploadOptions,
  ): Promise<readonly ControlledAttachmentUploadResult[]>;
  withdrawAttachment(target: AttachmentDownloadRequest, version: number): Promise<void>;
  downloadAttachment(request: AttachmentDownloadRequest): Promise<ControlledDownload>;
  downloadFileField(request: FileFieldDownloadRequest): Promise<ControlledDownload>;
}

async function readPayload(response: Response, fallback: unknown): Promise<unknown> {
  if (fallback !== undefined) return fallback;

  try {
    return await response.clone().json();
  } catch {
    return undefined;
  }
}

function serializeRequestQuery(request: Record<string, unknown>): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(request)) {
    if (value !== undefined && value !== null) parameters.set(key, String(value));
  }
  return parameters.toString();
}

function toStageWorkflowFileUploadIntent(value: unknown): StageWorkflowFileUploadIntent | null {
  const source = recordOf(value);
  const draftId = source === null ? null : positiveInteger(source.draftId);
  const fieldCode = source === null ? null : nonBlankString(source.fieldCode);
  const fileId = source === null ? null : positiveInteger(source.fileId);
  const uploadUrl = source === null ? null : nonBlankString(source.uploadUrl);
  const expiresAt = source === null ? null : isoDateTime(source.expiresAt);
  if (
    source === null ||
    draftId === null ||
    fieldCode === null ||
    fileId === null ||
    uploadUrl === null ||
    expiresAt === null ||
    source.uploadMethod !== "PUT"
  ) {
    return null;
  }
  try {
    const parsedUrl = new URL(uploadUrl);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") return null;
  } catch {
    return null;
  }
  const requiredHeadersSource = recordOf(source.requiredHeaders);
  if (requiredHeadersSource === null) return null;
  const requiredHeaders: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(requiredHeadersSource)) {
    const parsedHeaderValue = nonBlankString(headerValue);
    if (nonBlankString(key) === null || parsedHeaderValue === null) return null;
    requiredHeaders[key] = parsedHeaderValue;
  }
  try {
    new Headers(requiredHeaders);
  } catch {
    return null;
  }
  return {
    draftId,
    expiresAt,
    fieldCode,
    fileId,
    requiredHeaders,
    uploadMethod: "PUT",
    uploadUrl,
  };
}

function validUploadFile(file: File): boolean {
  return (
    Number.isSafeInteger(file.size) &&
    file.size > 0 &&
    nonBlankString(file.name) !== null &&
    file.size <= Number.MAX_SAFE_INTEGER
  );
}

function validCrmImportSourceFile(file: File): boolean {
  return (
    validUploadFile(file) &&
    file.size <= 1024 * 1024 &&
    file.name.trim().toLowerCase().endsWith(".csv")
  );
}

const controlledAttachmentMediaTypes = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
} as const;

function controlledAttachmentMediaType(file: File): string | null {
  const fileName = file.name.trim().toLowerCase();
  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex < 0) return null;
  const extension = fileName.slice(extensionIndex) as keyof typeof controlledAttachmentMediaTypes;
  return controlledAttachmentMediaTypes[extension] ?? null;
}

function validControlledAttachmentTarget(target: ControlledAttachmentTarget): boolean {
  return Number.isSafeInteger(target.targetId) && target.targetId > 0;
}

function validControlledAttachmentIntent(
  intent: components["schemas"]["AttachmentUploadIntentResponse"],
  file: File,
  declaredMediaType: string,
): intent is components["schemas"]["AttachmentUploadIntentResponse"] & {
  draftId: number;
  expiresAt: string;
  fileId: number;
  version: number;
} {
  const expiresAt = intent.expiresAt === undefined ? Number.NaN : Date.parse(intent.expiresAt);
  return (
    intent.draftId !== undefined &&
    Number.isSafeInteger(intent.draftId) &&
    intent.draftId > 0 &&
    intent.fileId !== undefined &&
    Number.isSafeInteger(intent.fileId) &&
    intent.fileId > 0 &&
    intent.version !== undefined &&
    Number.isSafeInteger(intent.version) &&
    intent.version >= 0 &&
    intent.status === "UPLOADING" &&
    intent.displayName === file.name.trim() &&
    intent.declaredMediaType === declaredMediaType &&
    intent.expectedBytes === file.size &&
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now()
  );
}

export function createApiClient(auth: AuthAdapter): ApiClient {
  const client = createClient<paths>({ baseUrl: "" });

  client.use({
    async onRequest({ request }) {
      const init = await auth.apply({
        credentials: "same-origin",
        headers: new Headers(request.headers),
        method: request.method,
      });
      return new Request(request, init);
    },
  });

  async function get<T>(
    request: Promise<{ data?: unknown; error?: unknown; response: Response }>,
  ): Promise<T> {
    const { data, error, response } = await request;
    if (response.ok) return data as T;

    if (response.status === 401) await auth.handleUnauthorized();
    throw ApiError.fromResponse(response, await readPayload(response, error));
  }

  async function getDownload(
    request: Promise<{ data?: unknown; error?: unknown; response: Response }>,
  ): Promise<ControlledDownload> {
    const { data, error, response } = await request;
    if (!response.ok) {
      if (response.status === 401) await auth.handleUnauthorized();
      throw ApiError.fromResponse(response, await readPayload(response, error));
    }

    const blob = data instanceof Blob ? data : await response.blob();
    return createControlledDownload(response, blob);
  }

  async function uploadControlledAttachmentContent(
    target: ControlledAttachmentTarget,
    fileId: number,
    version: number,
    file: File,
  ): Promise<void> {
    const init = await auth.apply({
      credentials: "same-origin",
      headers: new Headers({ "Content-Type": "application/octet-stream" }),
      method: "PUT",
    });
    let response: Response;
    try {
      response = await fetch(
        `/api/v1/attachment-targets/${target.targetType}/${target.targetId}/attachments/${fileId}/content?version=${version}`,
        { ...init, body: file, method: "PUT" },
      );
    } catch {
      throw new Error("附件内容暂时无法上传，请检查网络后重试。");
    }
    if (response.ok) return;

    if (response.status === 401) await auth.handleUnauthorized();
    throw ApiError.fromResponse(response, await readPayload(response, undefined));
  }

  async function withdrawControlledAttachment(
    target: ControlledAttachmentTarget,
    fileId: number,
    version: number,
  ): Promise<void> {
    if (
      !validControlledAttachmentTarget(target) ||
      !Number.isSafeInteger(fileId) ||
      fileId <= 0 ||
      !Number.isSafeInteger(version) ||
      version < 0
    ) {
      throw new Error("附件撤回参数无效，请刷新后重试。");
    }
    await get<unknown>(
      client.DELETE("/api/v1/attachment-targets/{targetType}/{targetId}/attachments/{fileId}", {
        params: { path: { ...target, fileId }, query: { version } },
      }),
    );
  }

  async function bestEffortWithdrawCreatedAttachment(
    target: ControlledAttachmentTarget,
    candidate: { fileId: number; version: number },
  ): Promise<void> {
    let version = candidate.version;
    try {
      const status = await get<components["schemas"]["AttachmentUploadStatusResponse"]>(
        client.GET(
          "/api/v1/attachment-targets/{targetType}/{targetId}/attachments/{fileId}/upload-status",
          { params: { path: { ...target, fileId: candidate.fileId } } },
        ),
      );
      const statusVersion = status.version;
      if (
        typeof statusVersion === "number" &&
        Number.isSafeInteger(statusVersion) &&
        statusVersion >= 0
      ) {
        version = statusVersion;
      }
    } catch {
      // The candidate expiry policy is the safe fallback when status is temporarily unavailable.
    }
    try {
      await withdrawControlledAttachment(target, candidate.fileId, version);
    } catch {
      // Keep the original upload error; this best-effort cleanup must not mask it.
    }
  }

  async function uploadProductImageDraftContent(
    intent: components["schemas"]["ProductImageUploadIntentResponse"],
    file: File,
  ): Promise<void> {
    const origin = globalThis.location?.origin;
    if (origin === undefined) {
      throw new Error("产品图片上传暂时无法初始化，请刷新后重试。");
    }
    let uploadUrl: URL;
    try {
      uploadUrl = new URL(intent.uploadUrl, origin);
    } catch {
      throw new Error("产品图片上传意图暂时不可用，请重新选择图片。");
    }
    if (uploadUrl.origin !== origin || intent.method !== "PUT") {
      throw new Error("产品图片上传意图暂时不可用，请重新选择图片。");
    }

    const headers = new Headers(intent.headers);
    // Browsers calculate body length themselves and disallow callers from setting it.
    headers.delete("Content-Length");
    const init = await auth.apply({
      credentials: "same-origin",
      headers,
      method: intent.method,
    });
    let response: Response;
    try {
      response = await fetch(uploadUrl, { ...init, body: file, method: intent.method });
    } catch {
      throw new Error("产品图片内容暂时无法上传，请检查网络后重试。");
    }
    if (response.ok) return;

    if (response.status === 401) await auth.handleUnauthorized();
    throw ApiError.fromResponse(response, await readPayload(response, undefined));
  }

  return {
    getAuthorization: () => get<MemberAuthorization>(client.GET("/api/v1/authorization/me", {})),
    getNavigation: () => get<NavigationItem[]>(client.GET("/api/v1/navigation", {})),
    getAccessibleTenants: () =>
      get<components["schemas"]["TenantAccessResponse"][]>(
        client.GET("/api/v1/organization/tenants", {}),
      ),
    validateTenantAccess: (targetTenantId) =>
      get<components["schemas"]["TenantAccessResponse"]>(
        client.GET("/api/v1/organization/tenants/{targetTenantId}/access", {
          params: { path: { targetTenantId } },
        }),
      ),
    getLeadIntakeClients: () =>
      get<components["schemas"]["LeadIntakeClientResponse"][]>(
        client.GET("/api/v1/lead-intake-clients", {}),
      ),
    createLeadIntakeClient: () =>
      get<components["schemas"]["LeadIntakeClientCreatedResponse"]>(
        client.POST("/api/v1/lead-intake-clients", { body: {} }),
      ),
    deactivateLeadIntakeClient: (clientId, version) =>
      get<components["schemas"]["LeadIntakeClientResponse"]>(
        client.DELETE("/api/v1/lead-intake-clients/{clientId}", {
          params: { path: { clientId }, query: { version } },
        }),
      ),
    getConnectors: (query) =>
      get<components["schemas"]["ConnectorPageResponse"]>(
        client.POST("/api/v1/connectors/query", { body: query }),
      ),
    getConnector: (connectorId) =>
      get<components["schemas"]["ConnectorResponse"]>(
        client.GET("/api/v1/connectors/{connectorId}", { params: { path: { connectorId } } }),
      ),
    createConnector: () =>
      get<components["schemas"]["ConnectorCredentialCreatedResponse"]>(
        client.POST("/api/v1/connectors", { body: {} }),
      ),
    rotateConnectorCredential: (connectorId, version) =>
      get<components["schemas"]["ConnectorCredentialCreatedResponse"]>(
        client.POST("/api/v1/connectors/{connectorId}/credentials", {
          body: { version },
          params: { path: { connectorId } },
        }),
      ),
    revokeConnectorCredential: (connectorId, keyId, version) =>
      get<components["schemas"]["ConnectorResponse"]>(
        client.DELETE("/api/v1/connectors/{connectorId}/credentials/{keyId}", {
          params: { path: { connectorId, keyId }, query: { version } },
        }),
      ),
    updateConnectorStatus: (connectorId, request) =>
      get<components["schemas"]["ConnectorResponse"]>(
        client.PUT("/api/v1/connectors/{connectorId}/status", {
          body: request,
          params: { path: { connectorId } },
        }),
      ),
    getEnterpriseDataCapabilities: () =>
      get<components["schemas"]["EnterpriseDataCapabilityResponse"]>(
        client.GET("/api/v1/enterprise-data/capabilities", {}),
      ),
    searchEnterpriseData: (request) =>
      get<components["schemas"]["EnterpriseDataObservationResponse"][]>(
        client.POST("/api/v1/enterprise-data/search", { body: request }),
      ),
    lookupEnterpriseData: (request) =>
      get<components["schemas"]["EnterpriseDataObservationResponse"]>(
        client.POST("/api/v1/enterprise-data/lookup", { body: request }),
      ),
    previewEnterpriseDataAdoption: (request) =>
      get<components["schemas"]["EnterpriseDataAdoptionPreviewResponse"]>(
        client.POST("/api/v1/enterprise-data/adoption-preview", { body: request }),
      ),
    adoptEnterpriseData: (request) =>
      get<components["schemas"]["EnterpriseDataAdoptionResponse"]>(
        client.POST("/api/v1/enterprise-data/adopt", { body: request }),
      ),
    getNavigationPreference: () =>
      get<components["schemas"]["NavigationPreferenceResponse"]>(
        client.GET("/api/v1/navigation/preferences", {}),
      ),
    updateNavigationPreference: (request) =>
      get<components["schemas"]["NavigationPreferenceResponse"]>(
        client.PUT("/api/v1/navigation/preferences", { body: request }),
      ),
    getEmbeddedPageConfigurationOptions: () =>
      get<components["schemas"]["EmbeddedPageConfigurationOptionsResponse"]>(
        client.GET("/api/v1/embedded-pages/configuration-options", {}),
      ),
    getEmbeddedPages: (query) =>
      get<components["schemas"]["EmbeddedPagePageResponse"]>(
        client.GET("/api/v1/embedded-pages", { params: { query } }),
      ),
    createEmbeddedPage: (request) =>
      get<components["schemas"]["EmbeddedPageResponse"]>(
        client.POST("/api/v1/embedded-pages", { body: request }),
      ),
    updateEmbeddedPage: (pageId, request) =>
      get<components["schemas"]["EmbeddedPageResponse"]>(
        client.PUT("/api/v1/embedded-pages/{pageId}", {
          body: request,
          params: { path: { pageId } },
        }),
      ),
    deleteEmbeddedPage: (pageId, version) =>
      get<void>(
        client.DELETE("/api/v1/embedded-pages/{pageId}", {
          params: { path: { pageId }, query: { version } },
        }),
      ),
    getRenderedEmbeddedPages: (objectType, recordId, platform) =>
      get<components["schemas"]["RenderedEmbeddedPageResponse"][]>(
        client.GET("/api/v1/embedded-pages/objects/{objectType}/{recordId}", {
          params: { path: { objectType, recordId }, query: { platform } },
        }),
      ),
    getDashboardOverview: () =>
      get<components["schemas"]["DashboardOverviewResponse"]>(
        client.GET("/api/v1/dashboard/overview", {}),
      ),
    getDashboardPreference: () =>
      get<components["schemas"]["DashboardPreferenceResponse"]>(
        client.GET("/api/v1/dashboard/preferences", {}),
      ),
    updateDashboardPreference: (request) =>
      get<components["schemas"]["DashboardPreferenceResponse"]>(
        client.PUT("/api/v1/dashboard/preferences", { body: request }),
      ),
    getPerformanceTargets: (request) =>
      get<components["schemas"]["PerformanceTargetListResponse"]>(
        client.GET("/api/v1/dashboard/performance-targets", {
          params: { query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    createPerformanceTarget: (request) =>
      get<components["schemas"]["PerformanceTargetResponse"]>(
        client.POST("/api/v1/dashboard/performance-targets", { body: request }),
      ),
    importPerformanceTargets: (request) =>
      get<components["schemas"]["PerformanceTargetImportResponse"]>(
        client.POST("/api/v1/dashboard/performance-targets/import", { body: request }),
      ),
    updatePerformanceTarget: (targetId, request) =>
      get<components["schemas"]["PerformanceTargetResponse"]>(
        client.PUT("/api/v1/dashboard/performance-targets/{targetId}", {
          body: request,
          params: { path: { targetId } },
        }),
      ),
    deletePerformanceTarget: async (targetId, version) => {
      await get<void>(
        client.DELETE("/api/v1/dashboard/performance-targets/{targetId}", {
          params: { path: { targetId }, query: { version } },
        }),
      );
    },
    getDepartmentPerformanceTargets: (request) =>
      get<components["schemas"]["DepartmentPerformanceTargetListResponse"]>(
        client.GET("/api/v1/dashboard/department-performance-targets", {
          params: { query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    createDepartmentPerformanceTarget: (request) =>
      get<components["schemas"]["DepartmentPerformanceTargetResponse"]>(
        client.POST("/api/v1/dashboard/department-performance-targets", { body: request }),
      ),
    batchUpsertDepartmentPerformanceTargets: (request) =>
      get<components["schemas"]["DepartmentPerformanceTargetListResponse"]>(
        client.PUT("/api/v1/dashboard/department-performance-targets/batch", { body: request }),
      ),
    importDepartmentPerformanceTargets: (request) =>
      get<components["schemas"]["PerformanceTargetImportResponse"]>(
        client.POST("/api/v1/dashboard/department-performance-targets/import", { body: request }),
      ),
    updateDepartmentPerformanceTarget: (targetId, request) =>
      get<components["schemas"]["DepartmentPerformanceTargetResponse"]>(
        client.PUT("/api/v1/dashboard/department-performance-targets/{targetId}", {
          body: request,
          params: { path: { targetId } },
        }),
      ),
    deleteDepartmentPerformanceTarget: async (targetId, version) => {
      await get<void>(
        client.DELETE("/api/v1/dashboard/department-performance-targets/{targetId}", {
          params: { path: { targetId }, query: { version } },
        }),
      );
    },
    getCoreReport: () =>
      get<components["schemas"]["CoreReportResponse"]>(client.GET("/api/v1/reports/core", {})),
    getReportTrend: (request) =>
      get<components["schemas"]["ReportTrendResponse"]>(
        client.POST("/api/v1/reports/trends", { body: request }),
      ),
    getReportRanking: (request) =>
      get<components["schemas"]["ReportRankingResponse"]>(
        client.POST("/api/v1/reports/rankings", { body: request }),
      ),
    getReportCatalog: (objectType) =>
      get<components["schemas"]["ReportCatalogResponse"]>(
        client.GET("/api/v1/reports/catalog", {
          params: { query: objectType === undefined ? {} : { objectType } },
        }),
      ),
    getReportDefinitions: (request) =>
      get<components["schemas"]["ReportDefinitionPageResponse"]>(
        client.POST("/api/v1/reports/definitions/query", { body: request }),
      ),
    getReportDefinition: (definitionId) =>
      get<components["schemas"]["ReportDefinitionResponse"]>(
        client.GET("/api/v1/reports/definitions/{definitionId}", {
          params: { path: { definitionId } },
        }),
      ),
    createReportDefinition: (request) =>
      get<components["schemas"]["ReportDefinitionResponse"]>(
        client.POST("/api/v1/reports/definitions", { body: request }),
      ),
    updateReportDefinition: (definitionId, request) =>
      get<components["schemas"]["ReportDefinitionResponse"]>(
        client.PUT("/api/v1/reports/definitions/{definitionId}", {
          body: request,
          params: { path: { definitionId } },
        }),
      ),
    deleteReportDefinition: (definitionId, version) =>
      get<void>(
        client.DELETE("/api/v1/reports/definitions/{definitionId}", {
          params: { path: { definitionId }, query: { version } },
        }),
      ),
    runReportDefinition: (definitionId, request) =>
      get<components["schemas"]["ReportDefinitionRunResponse"]>(
        client.POST("/api/v1/reports/definitions/{definitionId}/run", {
          body: request,
          params: { path: { definitionId } },
        }),
      ),
    getMarketingFormConfigurationOptions: (formId, targetObjectType) =>
      get<components["schemas"]["MarketingFormConfigurationOptionsResponse"]>(
        client.GET("/api/v1/marketing-forms/configuration-options", {
          params: {
            query: {
              ...(formId === undefined ? {} : { formId }),
              ...(targetObjectType === undefined ? {} : { targetObjectType }),
            },
          },
        }),
      ),
    getMarketingForms: (request) =>
      get<components["schemas"]["MarketingFormPageResponse"]>(
        client.GET("/api/v1/marketing-forms", {
          params: { query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    getMarketingForm: (formId) =>
      get<components["schemas"]["MarketingFormResponse"]>(
        client.GET("/api/v1/marketing-forms/{formId}", { params: { path: { formId } } }),
      ),
    createMarketingForm: (request) =>
      get<components["schemas"]["MarketingFormResponse"]>(
        client.POST("/api/v1/marketing-forms", { body: request }),
      ),
    updateMarketingForm: (formId, request) =>
      get<components["schemas"]["MarketingFormResponse"]>(
        client.PUT("/api/v1/marketing-forms/{formId}", {
          body: request,
          params: { path: { formId } },
        }),
      ),
    updateMarketingFormStatus: (formId, request) =>
      get<components["schemas"]["MarketingFormResponse"]>(
        client.PUT("/api/v1/marketing-forms/{formId}/status", {
          body: request,
          params: { path: { formId } },
        }),
      ),
    deleteMarketingForm: (formId, version) =>
      get<void>(
        client.DELETE("/api/v1/marketing-forms/{formId}", {
          params: { path: { formId }, query: { version } },
        }),
      ),
    getMarketingActivityConfigurationOptions: () =>
      get<components["schemas"]["MarketingActivityConfigurationOptionsResponse"]>(
        client.GET("/api/v1/marketing-activities/configuration-options"),
      ),
    getMarketingActivities: (request) =>
      get<components["schemas"]["MarketingActivityPageResponse"]>(
        client.GET("/api/v1/marketing-activities", {
          params: { query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    getMarketingActivity: (activityId) =>
      get<components["schemas"]["MarketingActivityResponse"]>(
        client.GET("/api/v1/marketing-activities/{activityId}", {
          params: { path: { activityId } },
        }),
      ),
    createMarketingActivity: (request) =>
      get<components["schemas"]["MarketingActivityResponse"]>(
        client.POST("/api/v1/marketing-activities", { body: request }),
      ),
    updateMarketingActivity: (activityId, request) =>
      get<components["schemas"]["MarketingActivityResponse"]>(
        client.PUT("/api/v1/marketing-activities/{activityId}", {
          body: request,
          params: { path: { activityId } },
        }),
      ),
    deleteMarketingActivities: (request) =>
      get<void>(client.POST("/api/v1/marketing-activities/batch-delete", { body: request })),
    deleteMarketingActivity: (activityId, version) =>
      get<void>(
        client.DELETE("/api/v1/marketing-activities/{activityId}", {
          params: { path: { activityId }, query: { version } },
        }),
      ),
    getMarketingFormSubmissionTrend: (formId, request) =>
      get<components["schemas"]["MarketingFormSubmissionTrendResponse"]>(
        client.POST("/api/v1/marketing-forms/{formId}/submissions/trends", {
          body: request,
          params: { path: { formId } },
        }),
      ),
    getMarketingFormSubmissionLinks: (formId, request) =>
      get<components["schemas"]["MarketingFormSubmissionLinkPageResponse"]>(
        client.POST("/api/v1/marketing-forms/{formId}/submissions/query", {
          body: request,
          params: { path: { formId } },
        }),
      ),
    getOaForms: (request) =>
      get<components["schemas"]["OaFormPageResponse"]>(
        client.GET("/api/v1/oa/forms", {
          params: { query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    getOaFormConfigurationOptions: () =>
      get<components["schemas"]["OaFormConfigurationOptionsResponse"]>(
        client.GET("/api/v1/oa/forms/configuration-options", {}),
      ),
    getOaForm: (formId) =>
      get<components["schemas"]["OaFormResponse"]>(
        client.GET("/api/v1/oa/forms/{formId}", { params: { path: { formId } } }),
      ),
    createOaForm: (request) =>
      get<components["schemas"]["OaFormResponse"]>(
        client.POST("/api/v1/oa/forms", { body: request }),
      ),
    updateOaForm: (formId, request) =>
      get<components["schemas"]["OaFormResponse"]>(
        client.PUT("/api/v1/oa/forms/{formId}", { params: { path: { formId } }, body: request }),
      ),
    updateOaFormStatus: (formId, request) =>
      get<components["schemas"]["OaFormResponse"]>(
        client.PUT("/api/v1/oa/forms/{formId}/status", {
          params: { path: { formId } },
          body: request,
        }),
      ),
    deleteOaForm: (formId, version) =>
      get<void>(
        client.DELETE("/api/v1/oa/forms/{formId}", {
          params: { path: { formId }, query: { version } },
        }),
      ),
    getAvailableOaForms: () =>
      get<components["schemas"]["OaFormResponse"][]>(client.GET("/api/v1/oa/forms/available", {})),
    getAvailableOaForm: (formId) =>
      get<components["schemas"]["OaFormResponse"]>(
        client.GET("/api/v1/oa/forms/available/{formId}", { params: { path: { formId } } }),
      ),
    getOaFormFieldCandidates: (formId, fieldCode, query) =>
      get<components["schemas"]["OaFormFieldCandidatePageResponse"]>(
        client.GET("/api/v1/oa/forms/available/{formId}/fields/{fieldCode}/candidates", {
          params: { path: { formId, fieldCode }, query },
        }),
      ),
    getOaFormApprovalSelectionCandidates: (formId, selectionCode, query) =>
      get<components["schemas"]["ApprovalSelectionCandidatePageResponse"]>(
        client.GET(
          "/api/v1/oa/forms/available/{formId}/approval-selections/{selectionCode}/candidates",
          { params: { path: { formId, selectionCode }, query } },
        ),
      ),
    async createOaFileFieldDraft(formId, formVersion) {
      const draft = await get<components["schemas"]["FileFieldDraftResponse"]>(
        client.POST("/api/v1/oa/forms/{formId}/file-field-drafts", {
          body: { formVersion },
          params: { path: { formId } },
        }),
      );
      if (
        draft.formId !== formId ||
        draft.formVersion !== formVersion ||
        Date.parse(draft.expiresAt) <= Date.now()
      ) {
        throw new Error("OA 文件草稿暂时不可用，请重新选择文件。");
      }
      return draft;
    },
    async createCrmFileFieldDraft(objectType) {
      const draft = await get<components["schemas"]["FileFieldDraftResponse"]>(
        client.POST("/api/v1/file-field-drafts", { body: { objectType } }),
      );
      if (
        draft.objectType !== objectType ||
        draft.formId !== undefined ||
        draft.formVersion !== undefined ||
        Date.parse(draft.expiresAt) <= Date.now()
      ) {
        throw new Error("客户文件草稿暂时不可用，请重新选择文件。");
      }
      return draft;
    },
    async uploadOaFileFieldFiles(draft, fieldCode, files) {
      if (files.length === 0 || files.some((file) => !validUploadFile(file))) {
        throw new Error("请选择名称和大小均有效的文件后再上传。");
      }
      if (Date.parse(draft.expiresAt) <= Date.now()) {
        throw new Error("OA 文件草稿已过期，请重新选择文件。");
      }

      const uploadedFiles: components["schemas"]["FileFieldUploadedFileResponse"][] = [];
      for (const file of files) {
        const intent = await get<components["schemas"]["FileFieldUploadIntentResponse"]>(
          client.POST("/api/v1/file-field-drafts/{draftId}/fields/{fieldCode}/upload-intents", {
            body: {
              declaredMediaType: file.type.trim() || "application/octet-stream",
              displayName: file.name.trim(),
              expectedBytes: file.size,
            },
            params: { path: { draftId: draft.id, fieldCode } },
          }),
        );
        if (
          intent.draftId !== draft.id ||
          intent.fieldCode !== fieldCode ||
          Date.parse(intent.expiresAt) <= Date.now()
        ) {
          throw new Error("OA 文件上传意图暂时不可用，请重新选择文件。");
        }
        let uploadResponse: Response;
        try {
          uploadResponse = await fetch(intent.uploadUrl, {
            body: file,
            credentials: "omit",
            headers: intent.requiredHeaders,
            method: intent.uploadMethod,
          });
        } catch {
          throw new Error("OA 文件上传暂时失败，请检查网络后重新选择文件。");
        }
        if (!uploadResponse.ok) {
          throw new Error("OA 文件上传暂时失败，请重新选择文件。");
        }
        const uploaded = await get<components["schemas"]["FileFieldUploadedFileResponse"]>(
          client.GET(
            "/api/v1/file-field-drafts/{draftId}/fields/{fieldCode}/files/{fileId}/upload-status",
            { params: { path: { draftId: draft.id, fieldCode, fileId: intent.fileId } } },
          ),
        );
        if (uploaded.fileId !== intent.fileId) {
          throw new Error("OA 文件上传状态暂时不可用，请稍后重试。");
        }
        uploadedFiles.push(uploaded);
      }
      return { draft, files: uploadedFiles };
    },
    async uploadCrmFileFieldFiles(draft, fieldCode, files) {
      if (files.length === 0 || files.some((file) => !validUploadFile(file))) {
        throw new Error("请选择名称和大小均有效的文件后再上传。");
      }
      if (Date.parse(draft.expiresAt) <= Date.now()) {
        throw new Error("客户文件草稿已过期，请重新选择文件。");
      }

      const uploadedFiles: components["schemas"]["FileFieldUploadedFileResponse"][] = [];
      for (const file of files) {
        const intentPayload = await get<unknown>(
          client.POST("/api/v1/file-field-drafts/{draftId}/fields/{fieldCode}/upload-intents", {
            body: {
              declaredMediaType: file.type.trim() || "application/octet-stream",
              displayName: file.name.trim(),
              expectedBytes: file.size,
            },
            params: { path: { draftId: draft.id, fieldCode } },
          }),
        );
        const intent = toStageWorkflowFileUploadIntent(intentPayload);
        if (
          intent === null ||
          intent.draftId !== draft.id ||
          intent.fieldCode !== fieldCode ||
          Date.parse(intent.expiresAt) <= Date.now()
        ) {
          throw new Error("客户文件上传意图暂时不可用，请重新选择文件。");
        }

        let uploadResponse: Response;
        try {
          uploadResponse = await fetch(intent.uploadUrl, {
            body: file,
            credentials: "omit",
            headers: intent.requiredHeaders,
            method: intent.uploadMethod,
          });
        } catch {
          throw new Error("客户文件上传暂时失败，请检查网络后重新选择文件。");
        }
        if (!uploadResponse.ok) {
          throw new Error("客户文件上传暂时失败，请重新选择文件。");
        }

        const uploaded = await get<components["schemas"]["FileFieldUploadedFileResponse"]>(
          client.GET(
            "/api/v1/file-field-drafts/{draftId}/fields/{fieldCode}/files/{fileId}/upload-status",
            { params: { path: { draftId: draft.id, fieldCode, fileId: intent.fileId } } },
          ),
        );
        if (uploaded.fileId !== intent.fileId || uploaded.status !== "UPLOADED") {
          throw new Error("客户文件上传状态暂时不可用，请稍后重试。");
        }
        uploadedFiles.push(uploaded);
      }
      return { draft, files: uploadedFiles };
    },
    async uploadExistingCrmFileFieldFiles(target, fieldCode, files) {
      if (
        !validControlledAttachmentTarget(target) ||
        !/^[a-z][a-z0-9_]{1,63}$/.test(fieldCode) ||
        files.length === 0 ||
        files.some((file) => !validUploadFile(file))
      ) {
        throw new Error("请选择名称和大小均有效的文件后再上传。");
      }

      const uploadedFiles: ExistingCrmFileFieldUploadFile[] = [];
      const createdCandidates: { fileId: number; version: number }[] = [];
      try {
        for (const file of files) {
          const declaredMediaType = file.type.trim() || "application/octet-stream";
          const intent = await get<components["schemas"]["AttachmentUploadIntentResponse"]>(
            client.POST(
              "/api/v1/attachment-targets/{targetType}/{targetId}/file-fields/{fieldCode}/upload-intents",
              {
                body: {
                  declaredMediaType,
                  displayName: file.name.trim(),
                  expectedBytes: file.size,
                },
                params: { path: { ...target, fieldCode } },
              },
            ),
          );
          if (!validControlledAttachmentIntent(intent, file, declaredMediaType)) {
            throw new Error("字段文件上传意图暂时不可用，请重新选择文件后重试。");
          }
          createdCandidates.push({ fileId: intent.fileId, version: intent.version });

          await uploadControlledAttachmentContent(target, intent.fileId, intent.version, file);
          const status = await get<components["schemas"]["AttachmentUploadStatusResponse"]>(
            client.GET(
              "/api/v1/attachment-targets/{targetType}/{targetId}/attachments/{fileId}/upload-status",
              { params: { path: { ...target, fileId: intent.fileId } } },
            ),
          );
          const statusVersion = status.version;
          if (
            typeof statusVersion === "number" &&
            Number.isSafeInteger(statusVersion) &&
            statusVersion >= 0
          ) {
            createdCandidates[createdCandidates.length - 1] = {
              fileId: intent.fileId,
              version: statusVersion,
            };
          }
          uploadedFiles.push({ displayName: file.name.trim(), fileId: intent.fileId, status });
        }
      } catch (error) {
        for (const candidate of createdCandidates) {
          await bestEffortWithdrawCreatedAttachment(target, candidate);
        }
        throw error;
      }
      return { fieldCode, files: uploadedFiles };
    },
    getOaFileFieldUploadStatus: (draftId, fieldCode, fileId) =>
      get<components["schemas"]["FileFieldUploadedFileResponse"]>(
        client.GET(
          "/api/v1/file-field-drafts/{draftId}/fields/{fieldCode}/files/{fileId}/upload-status",
          { params: { path: { draftId, fieldCode, fileId } } },
        ),
      ),
    withdrawFileFieldDraft: (draftId, version) =>
      get<void>(
        client.DELETE("/api/v1/file-field-drafts/{draftId}", {
          params: { path: { draftId }, query: { version } },
        }),
      ),
    getOaRequests: (request) =>
      get<components["schemas"]["OaRequestPageResponse"]>(
        client.GET("/api/v1/oa/requests", {
          params: { query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    getOaRequest: (requestId) =>
      get<components["schemas"]["OaRequestResponse"]>(
        client.GET("/api/v1/oa/requests/{requestId}", { params: { path: { requestId } } }),
      ),
    downloadOaRequestFileField: (request) =>
      getDownload(
        client.GET("/api/v1/oa/requests/{requestId}/file-fields/{fieldCode}/{fileId}/content", {
          params: { path: request },
          parseAs: "blob",
        }),
      ),
    previewOaRequest: (request) =>
      get<components["schemas"]["OaRequestPreviewResponse"]>(
        client.POST("/api/v1/oa/requests/preview", { body: request }),
      ),
    submitOaRequest: (request) =>
      get<components["schemas"]["OaRequestResponse"]>(
        client.POST("/api/v1/oa/requests", { body: request }),
      ),
    getOaAnnouncements: (request) =>
      get<components["schemas"]["OaAnnouncementPageResponse"]>(
        client.GET("/api/v1/oa/announcements", {
          params: { query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    getOaAnnouncement: (announcementId) =>
      get<components["schemas"]["OaAnnouncementResponse"]>(
        client.GET("/api/v1/oa/announcements/{announcementId}", {
          params: { path: { announcementId } },
        }),
      ),
    getOaAnnouncementAudienceCandidates: (query) =>
      get<components["schemas"]["OaAnnouncementAudienceCandidatePageResponse"]>(
        client.GET("/api/v1/oa/announcements/audience-candidates", {
          params: { query },
        }),
      ),
    createOaAnnouncement: (request) =>
      get<components["schemas"]["OaAnnouncementResponse"]>(
        client.POST("/api/v1/oa/announcements", { body: request }),
      ),
    updateOaAnnouncement: (announcementId, request) =>
      get<components["schemas"]["OaAnnouncementResponse"]>(
        client.PUT("/api/v1/oa/announcements/{announcementId}", {
          params: { path: { announcementId } },
          body: request,
        }),
      ),
    deleteOaAnnouncement: (announcementId, version) =>
      get<void>(
        client.DELETE("/api/v1/oa/announcements/{announcementId}", {
          params: { path: { announcementId }, query: { version } },
        }),
      ),
    publishOaAnnouncement: (announcementId, request) =>
      get<void>(
        client.POST("/api/v1/oa/announcements/{announcementId}/publish", {
          params: { path: { announcementId } },
          body: request,
        }),
      ),
    scheduleOaAnnouncement: (announcementId, request) =>
      get<void>(
        client.POST("/api/v1/oa/announcements/{announcementId}/schedule", {
          params: { path: { announcementId } },
          body: request,
        }),
      ),
    cancelOaAnnouncementSchedule: (announcementId, request) =>
      get<void>(
        client.POST("/api/v1/oa/announcements/{announcementId}/cancel-schedule", {
          params: { path: { announcementId } },
          body: request,
        }),
      ),
    withdrawOaAnnouncement: (announcementId, request) =>
      get<void>(
        client.POST("/api/v1/oa/announcements/{announcementId}/withdraw", {
          params: { path: { announcementId } },
          body: request,
        }),
      ),
    getMyOaAnnouncementUnreadCount: () =>
      get<components["schemas"]["OaAnnouncementUnreadCountResponse"]>(
        client.GET("/api/v1/oa/announcements/unread-count", {}),
      ),
    getMyOaAnnouncements: (request) =>
      get<components["schemas"]["OaAnnouncementInboxPageResponse"]>(
        client.GET("/api/v1/oa/announcements/mine", {
          params: { query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    getMyOaAnnouncement: (announcementId) =>
      get<components["schemas"]["OaAnnouncementInboxResponse"]>(
        client.GET("/api/v1/oa/announcements/mine/{announcementId}", {
          params: { path: { announcementId } },
        }),
      ),
    markMyOaAnnouncementRead: (announcementId) =>
      get<components["schemas"]["OaAnnouncementReadReceiptResponse"]>(
        client.POST("/api/v1/oa/announcements/mine/{announcementId}/read", {
          params: { path: { announcementId } },
        }),
      ),
    async getNotificationPreference() {
      const payload = await get<unknown>(client.GET("/api/v1/notifications/preferences"));
      const preference = toNotificationPreference(payload);
      if (preference === null) throw new Error("通知偏好数据暂时不可用，请稍后重试。");
      return preference;
    },
    async updateNotificationPreference(request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/notifications/preferences", { body: request }),
      );
      const preference = toNotificationPreference(payload);
      if (preference === null) throw new Error("通知偏好响应暂时不可用，请稍后重试。");
      return preference;
    },
    getNotifications: (query) =>
      get<components["schemas"]["NotificationPageResponse"]>(
        client.GET("/api/v1/notifications", {
          params: { query: { request: query } },
          querySerializer: ({ request }) => serializeRequestQuery(request),
        }),
      ),
    async markNotificationRead(notificationId) {
      const payload = await get<unknown>(
        client.POST("/api/v1/notifications/{notificationId}/read", {
          params: { path: { notificationId } },
        }),
      );
      const notification = toNotificationInboxItem(payload);
      if (
        notification === null ||
        notification.id !== notificationId ||
        notification.status !== "READ"
      ) {
        throw new Error("通知已读响应暂时不可用，请稍后重试。");
      }
      return notification;
    },
    async getApprovalPendingCount() {
      const payload = await get<unknown>(client.GET("/api/v1/approvals/pending-count"));
      const count = toApprovalPendingCount(payload);
      if (count === null) throw new Error("审批待办数量暂时不可用，请稍后重试。");
      return count;
    },
    async getPendingApprovals(query) {
      const payload = await get<unknown>(
        client.POST("/api/v1/approvals/query", {
          body: { bucket: "PENDING", ...query },
        }),
      );
      const page = toApprovalPendingPage(payload);
      if (page === null) throw new Error("审批待办数据暂时不可用，请稍后重试。");
      return page;
    },
    async getApprovalPendingDetail(instanceId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/approvals/{instanceId}", { params: { path: { instanceId } } }),
      );
      const detail = toApprovalPendingDetail(payload);
      if (detail === null || detail.id !== instanceId) {
        throw new Error("审批详情数据暂时不可用，请稍后重试。");
      }
      return detail;
    },
    async getApprovalTransferCandidates(instanceId, query) {
      const payload = await get<unknown>(
        client.GET("/api/v1/approvals/{instanceId}/transfer-candidates", {
          params: { path: { instanceId }, query },
        }),
      );
      const page = toApprovalTransferCandidatePage(payload);
      if (page === null) throw new Error("转审候选人数据暂时不可用，请稍后重试。");
      return page;
    },
    async actOnApproval(instanceId, request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/approvals/{instanceId}/actions", {
          body: request,
          params: { path: { instanceId } },
        }),
      );
      const detail = toApprovalActionResult(payload);
      if (detail === null || detail.id !== instanceId) {
        throw new Error("审批操作响应暂时不可用，请稍后重试。");
      }
      return detail;
    },
    async withdrawApproval(instanceId, version) {
      const payload = await get<unknown>(
        client.POST("/api/v1/approvals/{instanceId}/withdraw", {
          params: { path: { instanceId }, query: { version } },
        }),
      );
      const detail = toApprovalActionResult(payload);
      if (detail === null || detail.id !== instanceId) {
        throw new Error("撤回审批响应暂时不可用，请稍后重试。");
      }
      return detail;
    },
    async cancelApproval(instanceId, version) {
      const payload = await get<unknown>(
        client.POST("/api/v1/approvals/{instanceId}/cancel", {
          params: { path: { instanceId }, query: { version } },
        }),
      );
      const detail = toApprovalActionResult(payload);
      if (detail === null || detail.id !== instanceId) {
        throw new Error("取消审批响应暂时不可用，请稍后重试。");
      }
      return detail;
    },
    async batchActOnApprovals(request) {
      const requestedIds = new Set(request.actions.map((action) => action.instanceId));
      if (request.actions.length === 0 || requestedIds.size !== request.actions.length) {
        throw new Error("批量审批请求暂时不可用，请稍后重试。");
      }
      const payload = await get<unknown>(
        client.POST("/api/v1/approvals/actions/batch", { body: request }),
      );
      const result = toApprovalBatchActionResult(payload);
      const responseIds = result === null ? [] : result.items.map((item) => item.instanceId);
      const responseMatchesRequest =
        result !== null &&
        responseIds.length === request.actions.length &&
        new Set(responseIds).size === responseIds.length &&
        responseIds.every((instanceId) => requestedIds.has(instanceId));
      const appliedResultIsComplete =
        result !== null &&
        result.applied &&
        result.items.every(
          (item) => item.status === "APPLIED" && item.errCode === "NONE" && item.version !== null,
        );
      const rejectedResultIsAtomic =
        result !== null &&
        !result.applied &&
        result.items.every((item) => item.status !== "APPLIED" && item.errCode !== "NONE");
      if (
        result === null ||
        !responseMatchesRequest ||
        (!appliedResultIsComplete && !rejectedResultIsAtomic)
      ) {
        throw new Error("批量审批响应暂时不可用，请稍后重试。");
      }
      return result;
    },
    async getApprovalStartOptions(objectType, subjectId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/approvals/subjects/{objectType}/{subjectId}/start-options", {
          params: { path: { objectType, subjectId } },
        }),
      );
      const options = toApprovalStartOptions(payload);
      if (
        options === null ||
        options.objectType !== objectType ||
        options.subjectId !== subjectId
      ) {
        throw new Error("审批发起选项暂时不可用，请稍后重试。");
      }
      return options;
    },
    async getApprovalStartSelectionCandidates(
      objectType,
      subjectId,
      definitionId,
      selectionCode,
      query,
    ) {
      const payload = await get<unknown>(
        client.GET(
          "/api/v1/approvals/subjects/{objectType}/{subjectId}/start-options/{definitionId}/selections/{selectionCode}/candidates",
          {
            params: {
              path: { definitionId, objectType, selectionCode, subjectId },
              query,
            },
          },
        ),
      );
      const page = toApprovalStartCandidatePage(payload);
      if (page === null) throw new Error("审批人候选数据暂时不可用，请稍后重试。");
      return page;
    },
    async previewApprovalRoute(definitionId, request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/approval-definitions/{definitionId}/preview", {
          body: request,
          params: { path: { definitionId } },
        }),
      );
      const preview = toApprovalRoutePreview(payload);
      if (
        preview === null ||
        preview.definitionId !== definitionId ||
        preview.subjectId !== request.subjectId
      ) {
        throw new Error("审批路由预览暂时不可用，请稍后重试。");
      }
      return preview;
    },
    async submitApproval(request) {
      const payload = await get<unknown>(client.POST("/api/v1/approvals", { body: request }));
      const approval = toApprovalPendingDetail(payload);
      if (approval === null) throw new Error("审批发起响应暂时不可用，请稍后重试。");
      return approval;
    },
    async getStageWorkflows(query) {
      const payload = await get<unknown>(
        client.POST("/api/v1/stage-workflows/query", { body: query }),
      );
      const page = toStageWorkflowSummaryPage(payload);
      if (page === null) throw new Error("阶段工作流数据暂时不可用，请稍后重试。");
      return page;
    },
    async getStageWorkflow(workflowId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/stage-workflows/{workflowId}", { params: { path: { workflowId } } }),
      );
      const workflow = toStageWorkflowDefinitionDetail(payload);
      if (workflow === null || workflow.id !== workflowId) {
        throw new Error("阶段工作流详情暂时不可用，请稍后重试。");
      }
      return workflow;
    },
    async getStageWorkflowEditableBaseline(workflowId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/stage-workflows/{workflowId}", { params: { path: { workflowId } } }),
      );
      const workflow = toStageWorkflowEditableBaseline(payload);
      if (workflow === null || workflow.id !== workflowId) {
        throw new Error("阶段工作流配置基线暂时不可用，请稍后重试。");
      }
      return workflow;
    },
    async getStageWorkflowConfigurationOptions(objectType) {
      const payload = await get<unknown>(
        client.GET("/api/v1/stage-workflows/configuration-options", {
          params: { query: objectType === undefined ? {} : { objectType } },
        }),
      );
      const options = toStageWorkflowConfigurationOptions(payload);
      if (options === null) {
        throw new Error("阶段工作流配置目录暂时不可用，请稍后重试。");
      }
      return options;
    },
    async getStageWorkflowConfigurationCandidates(candidateType, query) {
      const payload = await get<unknown>(
        client.GET("/api/v1/stage-workflows/configuration-options/candidates", {
          params: { query: { ...query, candidateType } },
        }),
      );
      const candidates = toStageWorkflowConfigurationCandidatePage(payload, candidateType);
      if (candidates === null) {
        throw new Error("阶段工作流配置候选暂时不可用，请稍后重试。");
      }
      return candidates;
    },
    async createStageWorkflow(request) {
      const payload = await get<unknown>(client.POST("/api/v1/stage-workflows", { body: request }));
      const workflow = toStageWorkflowMutationResult(payload);
      if (workflow === null || workflow.status !== "INACTIVE") {
        throw new Error("阶段工作流创建响应暂时不可用，请稍后重试。");
      }
      return workflow;
    },
    async updateStageWorkflow(workflowId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/stage-workflows/{workflowId}", {
          body: request,
          params: { path: { workflowId } },
        }),
      );
      const workflow = toStageWorkflowMutationResult(payload);
      if (workflow === null || workflow.id !== workflowId) {
        throw new Error("阶段工作流更新响应暂时不可用，请稍后重试。");
      }
      return workflow;
    },
    async updateStageWorkflowStatus(workflowId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/stage-workflows/{workflowId}/status", {
          body: request,
          params: { path: { workflowId } },
        }),
      );
      const workflow = toStageWorkflowMutationResult(payload);
      if (workflow === null || workflow.id !== workflowId) {
        throw new Error("阶段工作流状态更新响应暂时不可用，请稍后重试。");
      }
      return workflow;
    },
    async getApplicableStageWorkflows(objectType, recordId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/stage-workflows/applicable", {
          params: { query: { objectType, recordId } },
        }),
      );
      const workflows = toStageWorkflowApplicableOptions(payload);
      if (
        workflows === null ||
        workflows.objectType !== objectType ||
        workflows.recordId !== recordId
      ) {
        throw new Error("可启动阶段工作流暂时不可用，请稍后重试。");
      }
      return workflows;
    },
    async startStageWorkflow(workflowId, recordId) {
      const payload = await get<unknown>(
        client.POST("/api/v1/stage-workflows/{workflowId}/records/{recordId}", {
          params: { path: { recordId, workflowId } },
        }),
      );
      const workflowRecord = toStageWorkflowRecord(payload);
      if (
        workflowRecord === null ||
        workflowRecord.workflowId !== workflowId ||
        workflowRecord.recordId !== recordId
      ) {
        throw new Error("阶段工作流启动响应暂时不可用，请稍后重试。");
      }
      return workflowRecord;
    },
    async getStageWorkflowRecord(workflowRecordId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/stage-workflow-records/{workflowRecordId}", {
          params: { path: { workflowRecordId } },
        }),
      );
      const workflowRecord = toStageWorkflowRecord(payload);
      if (workflowRecord === null || workflowRecord.id !== workflowRecordId) {
        throw new Error("阶段工作流运行记录暂时不可用，请稍后重试。");
      }
      return workflowRecord;
    },
    async getStageWorkflowComments(workflowRecordId, query) {
      const payload = await get<unknown>(
        client.GET("/api/v1/stage-workflow-records/{workflowRecordId}/comments", {
          params: { path: { workflowRecordId }, query },
        }),
      );
      const comments = toStageWorkflowCommentPage(payload);
      if (
        comments === null ||
        comments.items.some((comment) => comment.workflowRecordId !== workflowRecordId)
      ) {
        throw new Error("阶段工作流评论暂时不可用，请稍后重试。");
      }
      return comments;
    },
    async createStageWorkflowComment(workflowRecordId, request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/stage-workflow-records/{workflowRecordId}/comments", {
          body: request,
          params: { path: { workflowRecordId } },
        }),
      );
      const comment = toStageWorkflowComment(payload);
      if (comment === null || comment.workflowRecordId !== workflowRecordId) {
        throw new Error("发表阶段工作流评论响应暂时不可用，请稍后重试。");
      }
      return comment;
    },
    async deleteStageWorkflowComment(workflowRecordId, commentId, version) {
      const payload = await get<unknown>(
        client.DELETE("/api/v1/stage-workflow-records/{workflowRecordId}/comments/{commentId}", {
          params: { path: { commentId, workflowRecordId }, query: { version } },
        }),
      );
      if (!isStageWorkflowCommentDeleted(payload, commentId)) {
        throw new Error("删除阶段工作流评论响应暂时不可用，请稍后重试。");
      }
    },
    async getStageWorkflowAdvanceSelectionCandidates(workflowRecordId, selectionCode, query) {
      const payload = await get<unknown>(
        client.GET(
          "/api/v1/stage-workflow-records/{workflowRecordId}/advance-options/{selectionCode}/candidates",
          { params: { path: { selectionCode, workflowRecordId }, query } },
        ),
      );
      const page = toApprovalStartCandidatePage(payload);
      if (page === null) throw new Error("阶段审批人候选暂时不可用，请稍后重试。");
      return page;
    },
    async getStageWorkflowFieldCandidates(workflowRecordId, fieldCode, query) {
      const payload = await get<unknown>(
        client.GET(
          "/api/v1/stage-workflow-records/{workflowRecordId}/writable-fields/{fieldCode}/candidates",
          { params: { path: { fieldCode, workflowRecordId }, query } },
        ),
      );
      const page = toStageWorkflowFieldCandidatePage(payload);
      if (page === null) throw new Error("阶段字段候选暂时不可用，请稍后重试。");
      return page;
    },
    async getStageWorkflowFileUploadStatus(draftId, fieldCode, fileId) {
      const payload = await get<unknown>(
        client.GET(
          "/api/v1/file-field-drafts/{draftId}/fields/{fieldCode}/files/{fileId}/upload-status",
          { params: { path: { draftId, fieldCode, fileId } } },
        ),
      );
      const uploadedFile = toStageWorkflowUploadedFile(payload);
      if (uploadedFile === null || uploadedFile.fileId !== fileId) {
        throw new Error("阶段文件上传状态暂时不可用，请稍后重试。");
      }
      return uploadedFile;
    },
    async uploadStageWorkflowFiles(workflowRecordId, fieldCode, files) {
      if (files.length === 0 || files.some((file) => !validUploadFile(file))) {
        throw new Error("请选择名称和大小均有效的文件后再上传。");
      }
      const draftPayload = await get<unknown>(
        client.POST(
          "/api/v1/stage-workflow-records/{workflowRecordId}/writable-fields/{fieldCode}/file-drafts",
          { params: { path: { fieldCode, workflowRecordId } } },
        ),
      );
      const draft = toStageWorkflowFileDraft(draftPayload);
      if (
        draft === null ||
        draft.workflowRecordId !== workflowRecordId ||
        draft.fieldCode !== fieldCode ||
        Date.parse(draft.expiresAt) <= Date.now()
      ) {
        throw new Error("阶段文件草稿暂时不可用，请重新选择文件。");
      }

      const uploadedFiles: StageWorkflowUploadedFile[] = [];
      for (const file of files) {
        const intentPayload = await get<unknown>(
          client.POST("/api/v1/file-field-drafts/{draftId}/fields/{fieldCode}/upload-intents", {
            body: {
              declaredMediaType: file.type.trim() || "application/octet-stream",
              displayName: file.name.trim(),
              expectedBytes: file.size,
            },
            params: { path: { draftId: draft.draftId, fieldCode } },
          }),
        );
        const intent = toStageWorkflowFileUploadIntent(intentPayload);
        if (
          intent === null ||
          intent.draftId !== draft.draftId ||
          intent.fieldCode !== fieldCode ||
          Date.parse(intent.expiresAt) <= Date.now()
        ) {
          throw new Error("阶段文件上传意图暂时不可用，请重新选择文件。");
        }

        let uploadResponse: Response;
        try {
          uploadResponse = await fetch(intent.uploadUrl, {
            body: file,
            credentials: "omit",
            headers: intent.requiredHeaders,
            method: intent.uploadMethod,
          });
        } catch {
          throw new Error("阶段文件上传暂时失败，请检查网络后重新选择文件。");
        }
        if (!uploadResponse.ok) {
          throw new Error("阶段文件上传暂时失败，请重新选择文件。");
        }

        const statusPayload = await get<unknown>(
          client.GET(
            "/api/v1/file-field-drafts/{draftId}/fields/{fieldCode}/files/{fileId}/upload-status",
            {
              params: {
                path: { draftId: draft.draftId, fieldCode, fileId: intent.fileId },
              },
            },
          ),
        );
        const uploadedFile = toStageWorkflowUploadedFile(statusPayload);
        if (uploadedFile === null || uploadedFile.fileId !== intent.fileId) {
          throw new Error("阶段文件上传状态暂时不可用，请稍后重试。");
        }
        uploadedFiles.push(uploadedFile);
      }
      return { draft, files: uploadedFiles };
    },
    async advanceStageWorkflow(workflowRecordId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/stage-workflow-records/{workflowRecordId}/advance", {
          body: request,
          params: { path: { workflowRecordId } },
        }),
      );
      const workflowRecord = toStageWorkflowActionRecord(payload);
      if (
        workflowRecord === null ||
        workflowRecord.id !== workflowRecordId ||
        workflowRecord.version === null
      ) {
        throw new Error("推进阶段工作流响应暂时不可用，请稍后重试。");
      }
      return workflowRecord;
    },
    async finishStageWorkflow(workflowRecordId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/stage-workflow-records/{workflowRecordId}/outcome", {
          body: request,
          params: { path: { workflowRecordId } },
        }),
      );
      const workflowRecord = toStageWorkflowActionRecord(payload);
      if (workflowRecord === null || workflowRecord.id !== workflowRecordId) {
        throw new Error("结束阶段工作流响应暂时不可用，请稍后重试。");
      }
      return workflowRecord;
    },
    async getApprovalDefinitions(query) {
      const payload = await get<unknown>(
        client.POST("/api/v1/approval-definitions/query", { body: query }),
      );
      const page = toApprovalDefinitionPage(payload);
      if (page === null) throw new Error("审批定义数据暂时不可用，请稍后重试。");
      return page;
    },
    async createApprovalDefinition(request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/approval-definitions", { body: request }),
      );
      const definition = toApprovalDefinitionListItem(payload);
      if (definition === null || definition.status !== "INACTIVE") {
        throw new Error("新建审批定义响应暂时不可用，请稍后重试。");
      }
      return definition;
    },
    async getApprovalDefinitionStatus(definitionId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/approval-definitions/{definitionId}", {
          params: { path: { definitionId } },
        }),
      );
      const baseline = toApprovalDefinitionStatusBaseline(payload);
      if (baseline === null || baseline.id !== definitionId) {
        throw new Error("审批定义状态数据暂时不可用，请稍后重试。");
      }
      return baseline;
    },
    async updateApprovalDefinitionStatus(definitionId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/approval-definitions/{definitionId}/status", {
          body: request,
          params: { path: { definitionId } },
        }),
      );
      const baseline = toApprovalDefinitionStatusBaseline(payload);
      if (baseline === null || baseline.id !== definitionId || baseline.status !== request.status) {
        throw new Error("审批定义状态响应暂时不可用，请稍后重试。");
      }
      return baseline;
    },
    async getApprovalDefinitionEditableBaseline(definitionId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/approval-definitions/{definitionId}", {
          params: { path: { definitionId } },
        }),
      );
      const baseline = toApprovalDefinitionEditableBaseline(payload);
      if (baseline === null || baseline.id !== definitionId) {
        throw new Error("当前定义不是可安全编辑的最小模板。");
      }
      return baseline;
    },
    async updateApprovalDefinition(definitionId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/approval-definitions/{definitionId}", {
          body: request,
          params: { path: { definitionId } },
        }),
      );
      const baseline = toApprovalDefinitionEditableBaseline(payload);
      if (baseline === null || baseline.id !== definitionId) {
        throw new Error("审批定义更新响应暂时不可用，请稍后重试。");
      }
      return baseline;
    },
    getActivities: (query) =>
      get<components["schemas"]["ActivityPageResponse"]>(
        client.POST("/api/v1/activities/query", { body: query }),
      ),
    getReturnVisits: (query) =>
      get<components["schemas"]["ReturnVisitPageResponse"]>(
        client.POST("/api/v1/return-visits/query", { body: query }),
      ),
    async getReturnVisit(returnVisitId) {
      const payload = await get<components["schemas"]["ReturnVisitResponse"]>(
        client.GET("/api/v1/return-visits/{returnVisitId}", {
          params: { path: { returnVisitId } },
        }),
      );
      const returnVisit = toReturnVisitDetail(payload);
      if (returnVisit === null || returnVisit.id !== returnVisitId) {
        throw new Error("回访详情数据暂时不可用，请稍后重试。");
      }
      return returnVisit;
    },
    async createReturnVisit(request) {
      const payload = await get<components["schemas"]["ReturnVisitResponse"]>(
        client.POST("/api/v1/return-visits", { body: request }),
      );
      const returnVisit = toReturnVisitDetail(payload);
      if (returnVisit === null || returnVisit.customerId !== request.customerId) {
        throw new Error("创建回访响应暂时不可用，请稍后重试。");
      }
      return returnVisit;
    },
    async updateReturnVisit(returnVisitId, request) {
      const payload = await get<components["schemas"]["ReturnVisitResponse"]>(
        client.PUT("/api/v1/return-visits/{returnVisitId}", {
          body: request,
          params: { path: { returnVisitId } },
        }),
      );
      const returnVisit = toReturnVisitDetail(payload);
      if (returnVisit === null || returnVisit.id !== returnVisitId) {
        throw new Error("更新回访响应暂时不可用，请稍后重试。");
      }
      return returnVisit;
    },
    async updateReturnVisitOwner(returnVisitId, request) {
      const payload = await get<components["schemas"]["ReturnVisitResponse"]>(
        client.PUT("/api/v1/return-visits/{returnVisitId}/owner", {
          body: request,
          params: { path: { returnVisitId } },
        }),
      );
      const returnVisit = toReturnVisitDetail(payload);
      if (returnVisit === null || returnVisit.id !== returnVisitId) {
        throw new Error("更新回访负责人响应暂时不可用，请稍后重试。");
      }
      return returnVisit;
    },
    async deleteReturnVisit(returnVisitId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/return-visits/{returnVisitId}", {
          params: { path: { returnVisitId }, query: { version } },
        }),
      );
    },
    async getActivityMethods() {
      const payload = await get<unknown>(client.GET("/api/v1/activities/options", {}));
      return decodeActivityMethodOptions(payload);
    },
    async getActivity(activityId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/activities/{activityId}", { params: { path: { activityId } } }),
      );
      const activity = toActivityDetail(payload);
      if (activity === null || activity.id !== activityId) {
        throw new Error("跟进记录编辑基线暂时不可用，请稍后重试。");
      }
      return activity;
    },
    async createActivity(request) {
      await get<unknown>(client.POST("/api/v1/activities", { body: request }));
    },
    async createActivitiesBatch(requests) {
      await get<unknown>(client.POST("/api/v1/activities/batch", { body: requests }));
    },
    async updateActivity(activityId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/activities/{activityId}", {
          body: request,
          params: { path: { activityId } },
        }),
      );
      const activity = toActivityDetail(payload);
      if (activity === null || activity.id !== activityId) {
        throw new Error("更新跟进记录响应暂时不可用，请稍后重试。");
      }
      return activity;
    },
    async deleteActivity(activityId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/activities/{activityId}", {
          params: { path: { activityId }, query: { version } },
        }),
      );
    },
    getCustomers: (query) =>
      get<components["schemas"]["CustomerPageResponse"]>(
        client.POST("/api/v1/customers/query", { body: query }),
      ),
    getNearbyCustomers: (query) =>
      get<components["schemas"]["Pager"]>(
        client.GET("/api/v1/customers/nearby", { params: { query } }),
      ),
    async getVisibleCustomers(query) {
      const payload = await get<components["schemas"]["CustomerPageResponse"]>(
        client.POST("/api/v1/customers/query", { body: query }),
      );
      return decodeCustomerOptions(payload);
    },
    getLeads: (query) =>
      get<components["schemas"]["LeadPageResponse"]>(
        client.POST("/api/v1/leads/query", { body: query }),
      ),
    getOpportunities: (query) =>
      get<components["schemas"]["OpportunityPageResponse"]>(
        client.POST("/api/v1/opportunities/query", { body: query }),
      ),
    async getOpportunitySummary(query) {
      const payload = await get<unknown>(
        client.POST("/api/v1/opportunities/summary", { body: query }),
      );
      const summary = toOpportunitySummary(payload);
      if (summary === null) throw new Error("商机汇总数据暂时不可用，请稍后重试。");
      return summary;
    },
    async getVisibleOpportunities(query) {
      const payload = await get<unknown>(
        client.POST("/api/v1/opportunities/query", { body: query }),
      );
      return decodeOpportunityOptions(payload);
    },
    getProducts: (query) =>
      get<components["schemas"]["ProductPageResponse"]>(
        client.POST("/api/v1/products/query", { body: query }),
      ),
    exportProductsCsv: (request) =>
      getDownload(
        client.POST("/api/v1/products/export/csv", {
          body: request,
          parseAs: "blob",
        }),
      ),
    async getProduct(productId) {
      const payload = await get<components["schemas"]["ProductResponse"]>(
        client.GET("/api/v1/products/{productId}", { params: { path: { productId } } }),
      );
      const product = toProductDetail(payload);
      if (product === null) throw new Error("产品详情数据暂时不可用，请稍后重试。");
      return product;
    },
    async getProductEditableBaseline(productId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/products/{productId}/editable-baseline", {
          params: { path: { productId } },
        }),
      );
      const baseline = toProductEditableBaseline(payload);
      if (baseline === null) throw new Error("产品安全编辑基线暂时不可用，请稍后重试。");
      return baseline;
    },
    async createProduct(request) {
      const payload = await get<components["schemas"]["ProductResponse"]>(
        client.POST("/api/v1/products", { body: request }),
      );
      const product = toProductDetail(payload);
      if (product === null) throw new Error("创建产品响应暂时不可用，请稍后重试。");
      return product;
    },
    createProductImageDraft: () =>
      get<components["schemas"]["ProductImageDraftResponse"]>(
        client.POST("/api/v1/product-image-drafts", {}),
      ),
    async uploadProductImageDraftFiles(draft, imageType, files) {
      if (
        !Number.isSafeInteger(draft.draftId) ||
        draft.draftId <= 0 ||
        Date.parse(draft.expiresAt) <= Date.now() ||
        (imageType !== "PRIMARY" && imageType !== "DETAIL")
      ) {
        throw new Error("产品图片草稿已过期或无效，请重新选择图片。");
      }
      if (files.length === 0 || files.some((file) => !validUploadFile(file))) {
        throw new Error("请选择名称和大小均有效的图片后再上传。");
      }

      const uploadedFiles: components["schemas"]["ProductImageUploadStatusResponse"][] = [];
      for (const file of files) {
        const declaredMediaType = controlledAttachmentMediaType(file);
        if (declaredMediaType !== "image/png" && declaredMediaType !== "image/jpeg") {
          throw new Error("产品图片仅支持 PNG、JPG 或 JPEG 格式。");
        }
        const intent = await get<components["schemas"]["ProductImageUploadIntentResponse"]>(
          client.POST("/api/v1/product-image-drafts/{draftId}/images/{imageType}/upload-intents", {
            body: {
              declaredMediaType,
              displayName: file.name.trim(),
              expectedBytes: file.size,
              productImageType: imageType,
            },
            params: { path: { draftId: draft.draftId, imageType } },
          }),
        );
        if (
          intent.draftId !== draft.draftId ||
          intent.imageType !== imageType ||
          !Number.isSafeInteger(intent.fileId) ||
          intent.fileId <= 0 ||
          Date.parse(intent.expiresAt) <= Date.now()
        ) {
          throw new Error("产品图片上传意图暂时不可用，请重新选择图片。");
        }
        await uploadProductImageDraftContent(intent, file);
        const status = await get<components["schemas"]["ProductImageUploadStatusResponse"]>(
          client.GET(
            "/api/v1/product-image-drafts/{draftId}/images/{imageType}/files/{fileId}/upload-status",
            { params: { path: { draftId: draft.draftId, imageType, fileId: intent.fileId } } },
          ),
        );
        if (
          status.draftId !== draft.draftId ||
          status.imageType !== imageType ||
          status.fileId !== intent.fileId
        ) {
          throw new Error("产品图片上传状态暂时不可用，请稍后刷新检查结果。");
        }
        uploadedFiles.push(status);
      }
      return { draft, files: uploadedFiles };
    },
    getProductImageDraftUploadStatus: (draftId, imageType, fileId) =>
      get<components["schemas"]["ProductImageUploadStatusResponse"]>(
        client.GET(
          "/api/v1/product-image-drafts/{draftId}/images/{imageType}/files/{fileId}/upload-status",
          { params: { path: { draftId, imageType, fileId } } },
        ),
      ),
    async withdrawProductImageDraft(draftId, version) {
      if (
        !Number.isSafeInteger(draftId) ||
        draftId <= 0 ||
        !Number.isSafeInteger(version) ||
        version < 0
      ) {
        throw new Error("产品图片草稿参数无效，请刷新后重试。");
      }
      await get<unknown>(
        client.DELETE("/api/v1/product-image-drafts/{draftId}", {
          params: { path: { draftId }, query: { version } },
        }),
      );
    },
    async updateProduct(productId, request) {
      const payload = await get<components["schemas"]["ProductResponse"]>(
        client.PUT("/api/v1/products/{productId}", {
          body: request,
          params: { path: { productId } },
        }),
      );
      const product = toProductDetail(payload);
      if (product === null) throw new Error("产品更新响应暂时不可用，请稍后重试。");
      return product;
    },
    async updateProductAvailability(productId, request) {
      const payload = await get<components["schemas"]["ProductResponse"]>(
        client.PUT("/api/v1/products/{productId}/availability", {
          params: { path: { productId } },
          body: request,
        }),
      );
      const product = toProductDetail(payload);
      if (product === null) throw new Error("产品可用性更新响应暂时不可用，请稍后重试。");
      return product;
    },
    async updateProductOwner(productId, request) {
      const payload = await get<components["schemas"]["ProductResponse"]>(
        client.PUT("/api/v1/products/{productId}/owner", {
          params: { path: { productId } },
          body: request,
        }),
      );
      const product = toProductDetail(payload);
      if (product === null) throw new Error("产品负责人更新响应暂时不可用，请稍后重试。");
      return product;
    },
    async deleteProduct(productId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/products/{productId}", {
          params: { path: { productId }, query: { version } },
        }),
      );
    },
    async getProductCategories() {
      const payload = await get<unknown>(client.GET("/api/v1/product-categories"));
      return decodeProductCategoryTree(payload);
    },
    async createProductCategory(request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/product-categories", { body: request }),
      );
      const category = decodeProductCategory(payload);
      if (category === null) throw new Error("创建产品分类响应暂时不可用，请稍后重试。");
      return category;
    },
    async updateProductCategory(categoryId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/product-categories/{categoryId}", {
          params: { path: { categoryId } },
          body: request,
        }),
      );
      const category = decodeProductCategory(payload);
      if (category === null) throw new Error("产品分类更新响应暂时不可用，请稍后重试。");
      return category;
    },
    async deleteProductCategory(categoryId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/product-categories/{categoryId}", {
          params: { path: { categoryId }, query: { version } },
        }),
      );
    },
    async getOpportunity(opportunityId) {
      const payload = await get<components["schemas"]["OpportunityResponse"]>(
        client.GET("/api/v1/opportunities/{opportunityId}", {
          params: { path: { opportunityId } },
        }),
      );
      const opportunity = toOpportunityDetail(payload);
      if (opportunity === null) throw new Error("商机详情数据暂时不可用，请稍后重试。");
      return opportunity;
    },
    async getOpportunityEditableBaseline(opportunityId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/opportunities/{opportunityId}/editable-baseline", {
          params: { path: { opportunityId } },
        }),
      );
      const baseline = toOpportunityEditableBaseline(payload);
      if (baseline === null) throw new Error("商机安全编辑基线暂时不可用，请稍后重试。");
      return baseline;
    },
    async getOpportunityCollaboratorBaseline(opportunityId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/opportunities/{opportunityId}/collaborators", {
          params: { path: { opportunityId } },
        }),
      );
      return decodeOpportunityCollaboratorBaseline(payload);
    },
    async getOpportunityContactsBaseline(opportunityId) {
      const payload = await get<components["schemas"]["OpportunityContactsBaselineResponse"]>(
        client.GET("/api/v1/opportunities/{opportunityId}/contacts/baseline", {
          params: { path: { opportunityId } },
        }),
      );
      return decodeOpportunityContactsBaseline(payload);
    },
    async getVisibleOpportunity(opportunityId) {
      const payload = await get<components["schemas"]["OpportunityResponse"]>(
        client.GET("/api/v1/opportunities/{opportunityId}", {
          params: { path: { opportunityId } },
        }),
      );
      const opportunity = toOpportunityDetail(payload);
      if (opportunity === null) throw new Error("商机详情数据暂时不可用，请稍后重试。");
      return toOpportunityOption({ ...opportunity, lastActivityTime: null });
    },
    async getOpportunityContacts(opportunityId) {
      const payload = await get<unknown>(
        client.POST("/api/v1/opportunities/{opportunityId}/contacts/query", {
          params: { path: { opportunityId }, query: { page: 1, size: 100 } },
        }),
      );
      return decodeOpportunityContacts(payload);
    },
    async getOpportunityProducts(opportunityId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/opportunities/{opportunityId}/products", {
          params: { path: { opportunityId } },
        }),
      );
      const products = toOpportunityProductSnapshot(payload);
      if (products === null) throw new Error("商机产品快照暂时不可用，请稍后重试。");
      return products;
    },
    async getOpportunityProductBaseline(opportunityId) {
      const payload = await get<components["schemas"]["OpportunityProductsResponse"]>(
        client.GET("/api/v1/opportunities/{opportunityId}/products", {
          params: { path: { opportunityId } },
        }),
      );
      const baseline = decodeOpportunityProductBaseline(payload);
      if (baseline.opportunityId !== opportunityId) {
        throw new Error("商机产品完整基线暂时不可用，请稍后重试。");
      }
      return baseline;
    },
    async createOpportunity(request) {
      const payload = await get<unknown>(client.POST("/api/v1/opportunities", { body: request }));
      const opportunity = toOpportunityDetail(payload);
      if (opportunity === null) throw new Error("新建商机响应暂时不可用，请稍后重试。");
      return opportunity;
    },
    async updateOpportunity(opportunityId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/opportunities/{opportunityId}", {
          body: request,
          params: { path: { opportunityId } },
        }),
      );
      const opportunity = toOpportunityDetail(payload);
      if (opportunity === null) throw new Error("商机更新响应暂时不可用，请稍后重试。");
      return opportunity;
    },
    async replaceOpportunityCollaborators(opportunityId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/opportunities/{opportunityId}/collaborators", {
          body: request,
          params: { path: { opportunityId } },
        }),
      );
      const opportunity = toOpportunityDetail(payload);
      if (opportunity === null) throw new Error("商机协作者更新响应暂时不可用，请稍后重试。");
      return opportunity;
    },
    async replaceOpportunityContacts(opportunityId, request) {
      const payload = await get<components["schemas"]["OpportunityResponse"]>(
        client.PUT("/api/v1/opportunities/{opportunityId}/contacts", {
          body: request,
          params: { path: { opportunityId } },
        }),
      );
      const opportunity = toOpportunityDetail(payload);
      if (opportunity === null) throw new Error("商机联系人更新响应暂时不可用，请稍后重试。");
      return opportunity;
    },
    async replaceOpportunityProducts(opportunityId, request) {
      const payload = await get<components["schemas"]["OpportunityProductsResponse"]>(
        client.PUT("/api/v1/opportunities/{opportunityId}/products", {
          body: request,
          params: { path: { opportunityId } },
        }),
      );
      const baseline = decodeOpportunityProductBaseline(payload);
      if (baseline.opportunityId !== opportunityId) {
        throw new Error("商机产品更新响应暂时不可用，请稍后重试。");
      }
      return baseline;
    },
    async exitOpportunityCollaborator(opportunityId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/opportunities/{opportunityId}/collaborators/me", {
          params: { path: { opportunityId }, query: { version } },
        }),
      );
    },
    async setOpportunityStarred(opportunityId, request) {
      await get<unknown>(
        client.PUT("/api/v1/opportunities/{opportunityId}/star", {
          params: { path: { opportunityId } },
          body: request,
        }),
      );
    },
    async updateOpportunityStage(opportunityId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/opportunities/{opportunityId}/stage", {
          params: { path: { opportunityId } },
          body: request,
        }),
      );
      const opportunity = toOpportunityDetail(payload);
      if (opportunity === null) throw new Error("更新商机阶段响应暂时不可用，请稍后重试。");
      return opportunity;
    },
    async updateOpportunityOutcome(opportunityId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/opportunities/{opportunityId}/outcome", {
          params: { path: { opportunityId } },
          body: request,
        }),
      );
      const opportunity = toOpportunityDetail(payload);
      if (opportunity === null) throw new Error("更新商机结果响应暂时不可用，请稍后重试。");
      return opportunity;
    },
    async updateOpportunityOwner(opportunityId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/opportunities/{opportunityId}/owner", {
          params: { path: { opportunityId } },
          body: request,
        }),
      );
      const opportunity = toOpportunityDetail(payload);
      if (opportunity === null) throw new Error("更新商机负责人响应暂时不可用，请稍后重试。");
      return opportunity;
    },
    async updateOpportunityOwners(request) {
      await get<void>(
        client.PUT("/api/v1/opportunities/batch/owner", {
          body: request,
        }),
      );
    },
    async updateOpportunityPrimaryContact(opportunityId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/opportunities/{opportunityId}/primary-contact", {
          params: { path: { opportunityId } },
          body: request,
        }),
      );
      const opportunity = toOpportunityDetail(payload);
      if (opportunity === null) throw new Error("更新商机首要联系人响应暂时不可用，请稍后重试。");
      return opportunity;
    },
    async deleteOpportunity(opportunityId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/opportunities/{opportunityId}", {
          params: { path: { opportunityId }, query: { version } },
        }),
      );
    },
    async deleteOpportunities(request) {
      await get<void>(
        client.POST("/api/v1/opportunities/batch/delete", {
          body: request,
        }),
      );
    },
    async getOpportunityPipelines(query) {
      const payload = await get<unknown>(
        client.POST("/api/v1/opportunity-pipelines/query", { body: query }),
      );
      return decodeOpportunityPipelineOptions(payload);
    },
    async getOpportunityPipelineStages(pipelineId, query) {
      const payload = await get<unknown>(
        client.POST("/api/v1/opportunity-pipelines/{pipelineId}/stages/query", {
          body: query,
          params: { path: { pipelineId } },
        }),
      );
      return decodeOpportunityPipelineStageOptions(payload);
    },
    queryOpportunityPipelineCatalog: (query) =>
      get<components["schemas"]["OpportunityPipelinePageResponse"]>(
        client.POST("/api/v1/opportunity-pipelines/query", { body: query }),
      ),
    async createOpportunityPipeline(request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/opportunity-pipelines", { body: request }),
      );
      const pipeline = toOpportunityPipelineCatalogItem(payload);
      if (pipeline === null) throw new Error("销售管线创建响应暂时不可用，请稍后重试。");
      return pipeline;
    },
    async updateOpportunityPipeline(pipelineId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/opportunity-pipelines/{pipelineId}", {
          body: request,
          params: { path: { pipelineId } },
        }),
      );
      const pipeline = toOpportunityPipelineCatalogItem(payload);
      if (pipeline === null) throw new Error("销售管线更新响应暂时不可用，请稍后重试。");
      return pipeline;
    },
    async updateOpportunityPipelineStatus(pipelineId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/opportunity-pipelines/{pipelineId}/status", {
          body: request,
          params: { path: { pipelineId } },
        }),
      );
      const pipeline = toOpportunityPipelineCatalogItem(payload);
      if (pipeline === null) throw new Error("销售管线状态响应暂时不可用，请稍后重试。");
      return pipeline;
    },
    async deleteOpportunityPipeline(pipelineId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/opportunity-pipelines/{pipelineId}", {
          params: { path: { pipelineId }, query: { version } },
        }),
      );
    },
    queryOpportunityPipelineStagesCatalog: (pipelineId, query) =>
      get<components["schemas"]["OpportunityPipelineStagePageResponse"]>(
        client.POST("/api/v1/opportunity-pipelines/{pipelineId}/stages/query", {
          body: query,
          params: { path: { pipelineId } },
        }),
      ),
    async createOpportunityPipelineStage(pipelineId, request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/opportunity-pipelines/{pipelineId}/stages", {
          body: request,
          params: { path: { pipelineId } },
        }),
      );
      const stage = toOpportunityPipelineStageCatalogItem(payload);
      if (stage === null) throw new Error("销售阶段创建响应暂时不可用，请稍后重试。");
      return stage;
    },
    async updateOpportunityPipelineStage(pipelineId, stageId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/opportunity-pipelines/{pipelineId}/stages/{stageId}", {
          body: request,
          params: { path: { pipelineId, stageId } },
        }),
      );
      const stage = toOpportunityPipelineStageCatalogItem(payload);
      if (stage === null) throw new Error("销售阶段更新响应暂时不可用，请稍后重试。");
      return stage;
    },
    async updateOpportunityPipelineStageStatus(pipelineId, stageId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/opportunity-pipelines/{pipelineId}/stages/{stageId}/status", {
          body: request,
          params: { path: { pipelineId, stageId } },
        }),
      );
      const stage = toOpportunityPipelineStageCatalogItem(payload);
      if (stage === null) throw new Error("销售阶段状态响应暂时不可用，请稍后重试。");
      return stage;
    },
    async deleteOpportunityPipelineStage(pipelineId, stageId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/opportunity-pipelines/{pipelineId}/stages/{stageId}", {
          params: { path: { pipelineId, stageId }, query: { version } },
        }),
      );
    },
    getNearbyLeads: (query) =>
      get<components["schemas"]["Pager"]>(
        client.GET("/api/v1/leads/nearby", { params: { query } }),
      ),
    async getLead(leadId) {
      const payload = await get<components["schemas"]["LeadResponse"]>(
        client.GET("/api/v1/leads/{leadId}", { params: { path: { leadId } } }),
      );
      const lead = toLeadDetail(payload);
      if (lead === null) throw new Error("线索详情数据暂时不可用，请稍后重试。");
      return lead;
    },
    async getLeadTagCatalog() {
      const payload = await get<unknown>(client.GET("/api/v1/leads/tags", {}));
      return decodeLeadTagCatalog(payload);
    },
    async getLeadCollaboratorBaseline(leadId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/leads/{leadId}/collaborators", {
          params: { path: { leadId } },
        }),
      );
      return decodeLeadCollaboratorBaseline(payload);
    },
    async getLeadHierarchy(leadId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/leads/{leadId}/hierarchy", {
          params: { path: { leadId } },
        }),
      );
      const hierarchy = toLeadHierarchy(payload, leadId);
      if (hierarchy === null) throw new Error("线索层级数据暂时不可用，请稍后重试。");
      return hierarchy;
    },
    exportLeadsCsv: (request) =>
      getDownload(
        client.POST("/api/v1/leads/export/csv", {
          body: request,
          parseAs: "blob",
        }),
      ),
    async createLead(request) {
      const payload = await get<components["schemas"]["LeadResponse"]>(
        client.POST("/api/v1/leads", { body: request }),
      );
      const lead = toLeadDetail(payload);
      if (lead === null) throw new Error("新建线索响应暂时不可用，请稍后重试。");
      return lead;
    },
    async convertLead(leadId, request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/leads/{leadId}/convert", {
          params: { path: { leadId } },
          body: request,
        }),
      );
      const conversion = toLeadConversion(payload, leadId);
      if (conversion === null) throw new Error("线索转换响应暂时不可用，请稍后重试。");
      return conversion;
    },
    async checkLeadDuplicate(request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/leads/duplicate-check", { body: request }),
      );
      const duplicate =
        payload !== null && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).duplicate
          : undefined;
      if (typeof duplicate !== "boolean") {
        throw new Error("线索查重响应暂时不可用，请稍后重试。");
      }
      return duplicate;
    },
    async setLeadStarred(leadId, request) {
      await get<unknown>(
        client.PUT("/api/v1/leads/{leadId}/star", {
          params: { path: { leadId } },
          body: request,
        }),
      );
    },
    async updateLeadState(leadId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/leads/{leadId}/state", {
          params: { path: { leadId } },
          body: request,
        }),
      );
      const lead = toLeadDetail(payload);
      if (lead === null) throw new Error("更新线索状态响应暂时不可用，请稍后重试。");
      return lead;
    },
    async replaceLeadTags(leadId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/leads/{leadId}/tags", {
          params: { path: { leadId } },
          body: request,
        }),
      );
      const lead = toLeadDetail(payload);
      if (lead === null) throw new Error("更新线索标签响应暂时不可用，请稍后重试。");
      return lead;
    },
    async changeLeadTags(request) {
      await get<void>(
        client.POST("/api/v1/leads/batch/tags", {
          body: request,
        }),
      );
    },
    async updateLeadOwners(request) {
      await get<void>(
        client.PUT("/api/v1/leads/batch/owner", {
          body: request,
        }),
      );
    },
    async deleteLeads(request) {
      await get<void>(
        client.POST("/api/v1/leads/batch/delete", {
          body: request,
        }),
      );
    },
    async updateLead(leadId, request) {
      const payload = await get<components["schemas"]["LeadResponse"]>(
        client.PUT("/api/v1/leads/{leadId}", {
          params: { path: { leadId } },
          body: request,
        }),
      );
      const lead = toLeadDetail(payload);
      if (lead === null) throw new Error("更新线索响应暂时不可用，请稍后重试。");
      return lead;
    },
    async updateLeadOwner(leadId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/leads/{leadId}/owner", {
          params: { path: { leadId } },
          body: request,
        }),
      );
      const lead = toLeadDetail(payload);
      if (lead === null) throw new Error("更新线索负责人响应暂时不可用，请稍后重试。");
      return lead;
    },
    async updateLeadParent(leadId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/leads/{leadId}/parent", {
          params: { path: { leadId } },
          body: request,
        }),
      );
      const lead = toLeadDetail(payload);
      if (lead === null) throw new Error("更新线索层级响应暂时不可用，请稍后重试。");
      return lead;
    },
    async replaceLeadCollaborators(leadId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/leads/{leadId}/collaborators", {
          params: { path: { leadId } },
          body: request,
        }),
      );
      const lead = toLeadDetail(payload);
      if (lead === null) throw new Error("更新线索协作者响应暂时不可用，请稍后重试。");
      return lead;
    },
    async exitLeadCollaborator(leadId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/leads/{leadId}/collaborators/me", {
          params: { path: { leadId }, query: { version } },
        }),
      );
    },
    async deleteLead(leadId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/leads/{leadId}", {
          params: { path: { leadId }, query: { version } },
        }),
      );
    },
    getContacts: (query) =>
      get<components["schemas"]["ContactPageResponse"]>(
        client.POST("/api/v1/contacts/query", { body: query }),
      ),
    getNearbyContacts: (query) =>
      get<components["schemas"]["Pager"]>(
        client.GET("/api/v1/contacts/nearby", { params: { query } }),
      ),
    getContracts: (query) =>
      get<components["schemas"]["ContractPageResponse"]>(
        client.POST("/api/v1/contracts/query", { body: query }),
      ),
    getContractSummary: (query) =>
      get<components["schemas"]["ContractListSummaryResponse"]>(
        client.POST("/api/v1/contracts/summary", { body: query }),
      ),
    async getVisibleContracts(query) {
      const payload = await get<components["schemas"]["ContractPageResponse"]>(
        client.POST("/api/v1/contracts/query", { body: query }),
      );
      return decodeContractOptions(payload);
    },
    async getVisibleContract(contractId) {
      const payload = await get<components["schemas"]["ContractResponse"]>(
        client.GET("/api/v1/contracts/{contractId}", { params: { path: { contractId } } }),
      );
      const contract = toContractDetail(payload);
      if (contract === null || contract.id !== contractId) {
        throw new Error("合同详情数据暂时不可用，请稍后重试。");
      }
      return toContractOption(contract);
    },
    async getContract(contractId) {
      const payload = await get<components["schemas"]["ContractResponse"]>(
        client.GET("/api/v1/contracts/{contractId}", { params: { path: { contractId } } }),
      );
      const contract = toContractDetail(payload);
      if (contract === null || contract.id !== contractId) {
        throw new Error("合同详情数据暂时不可用，请稍后重试。");
      }
      return contract;
    },
    async getContractCollaboratorBaseline(contractId) {
      const payload = await get<components["schemas"]["ContractCollaboratorBaselineResponse"]>(
        client.GET("/api/v1/contracts/{contractId}/collaborators", {
          params: { path: { contractId } },
        }),
      );
      return decodeContractCollaboratorBaseline(payload);
    },
    async getContractProductBaseline(contractId) {
      const payload = await get<components["schemas"]["ContractProductsResponse"]>(
        client.GET("/api/v1/contracts/{contractId}/products", {
          params: { path: { contractId } },
        }),
      );
      const baseline = decodeContractProductBaseline(payload);
      if (baseline.contractId !== contractId) {
        throw new Error("合同产品完整基线暂时不可用，请稍后重试。");
      }
      return baseline;
    },
    async createContract(request) {
      const payload = await get<components["schemas"]["ContractResponse"]>(
        client.POST("/api/v1/contracts", { body: request }),
      );
      const contract = toContractDetail(payload);
      if (contract === null) throw new Error("新建合同响应暂时不可用，请稍后重试。");
      return contract;
    },
    async updateContract(contractId, request) {
      const payload = await get<components["schemas"]["ContractResponse"]>(
        client.PATCH("/api/v1/contracts/{contractId}", {
          body: request,
          params: { path: { contractId } },
        }),
      );
      const contract = toContractDetail(payload);
      if (contract === null || contract.id !== contractId) {
        throw new Error("更新合同响应暂时不可用，请稍后重试。");
      }
      return contract;
    },
    async replaceContractProducts(contractId, request) {
      const payload = await get<components["schemas"]["ContractProductsResponse"]>(
        client.PUT("/api/v1/contracts/{contractId}/products", {
          body: request,
          params: { path: { contractId } },
        }),
      );
      const baseline = decodeContractProductBaseline(payload);
      if (baseline.contractId !== contractId) {
        throw new Error("合同产品更新结果暂时不可用，请稍后重试。");
      }
      return baseline;
    },
    async deleteContract(contractId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/contracts/{contractId}", {
          params: { path: { contractId }, query: { version } },
        }),
      );
    },
    exportSelectedContractsCsv: (request) =>
      getDownload(
        client.POST("/api/v1/contracts/batch/export/csv", {
          body: request,
          parseAs: "blob",
        }),
      ),
    async updateContractOwners(request) {
      await get<unknown>(
        client.PUT("/api/v1/contracts/batch/owner", {
          body: request,
        }),
      );
    },
    async deleteContracts(request) {
      await get<unknown>(
        client.POST("/api/v1/contracts/batch/delete", {
          body: request,
        }),
      );
    },
    async addContractCollaborators(request) {
      await get<unknown>(
        client.PUT("/api/v1/contracts/batch/collaborators", {
          body: request,
        }),
      );
    },
    async removeContractCollaborators(request) {
      await get<unknown>(
        client.DELETE("/api/v1/contracts/batch/collaborators", {
          body: request,
        }),
      );
    },
    async voidContract(contractId, version) {
      await get<components["schemas"]["ContractResponse"]>(
        client.PUT("/api/v1/contracts/{contractId}/void", {
          body: { version },
          params: { path: { contractId } },
        }),
      );
    },
    async updateContractOwner(contractId, request) {
      const payload = await get<components["schemas"]["ContractResponse"]>(
        client.PUT("/api/v1/contracts/{contractId}/owner", {
          body: request,
          params: { path: { contractId } },
        }),
      );
      const contract = toContractDetail(payload);
      if (contract === null || contract.id !== contractId) {
        throw new Error("合同负责人更新响应暂时不可用，请稍后重试。");
      }
      return contract;
    },
    async replaceContractCollaborators(contractId, request) {
      const payload = await get<components["schemas"]["ContractResponse"]>(
        client.PUT("/api/v1/contracts/{contractId}/collaborators", {
          body: request,
          params: { path: { contractId } },
        }),
      );
      const contract = toContractDetail(payload);
      if (contract === null || contract.id !== contractId) {
        throw new Error("合同协作者更新响应暂时不可用，请稍后重试。");
      }
      return contract;
    },
    async exitContractCollaborator(contractId, version) {
      await get<components["schemas"]["ContractResponse"]>(
        client.DELETE("/api/v1/contracts/{contractId}/collaborators/me", {
          params: { path: { contractId }, query: { version } },
        }),
      );
    },
    async getInvoiceProfiles(customerId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/invoice-profiles", { params: { query: { customerId } } }),
      );
      const profiles = decodeInvoiceProfileList(payload);
      if (profiles === null) throw new Error("开票资料数据暂时不可用，请稍后重试。");
      return profiles;
    },
    getInvoices: (query) =>
      get<components["schemas"]["InvoicePageResponse"]>(
        client.POST("/api/v1/invoices/query", { body: query }),
      ),
    async getInvoice(invoiceId) {
      const payload = await get<components["schemas"]["InvoiceResponse"]>(
        client.GET("/api/v1/invoices/{invoiceId}", { params: { path: { invoiceId } } }),
      );
      const invoice = toInvoiceListItem(payload);
      if (invoice === null) throw new Error("发票详情数据暂时不可用，请稍后重试。");
      return invoice;
    },
    async createInvoice(request) {
      const payload = await get<components["schemas"]["InvoiceResponse"]>(
        client.POST("/api/v1/invoices", { body: request }),
      );
      const invoice = toInvoiceListItem(payload);
      if (invoice === null) throw new Error("新建发票响应暂时不可用，请稍后重试。");
      return invoice;
    },
    async updateInvoice(invoiceId, request) {
      const payload = await get<components["schemas"]["InvoiceResponse"]>(
        client.PATCH("/api/v1/invoices/{invoiceId}", {
          body: request,
          params: { path: { invoiceId } },
        }),
      );
      const invoice = toInvoiceListItem(payload);
      if (invoice === null) throw new Error("发票更新响应暂时不可用，请稍后重试。");
      return invoice;
    },
    async issueInvoice(invoiceId, request) {
      const payload = await get<components["schemas"]["InvoiceResponse"]>(
        client.PUT("/api/v1/invoices/{invoiceId}/issue", {
          body: request,
          params: { path: { invoiceId } },
        }),
      );
      const invoice = toInvoiceListItem(payload);
      if (invoice === null) throw new Error("开票结果登记响应暂时不可用，请稍后重试。");
      return invoice;
    },
    async deleteInvoice(invoiceId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/invoices/{invoiceId}", {
          params: { path: { invoiceId }, query: { version } },
        }),
      );
    },
    async deleteInvoices(request) {
      await get<unknown>(client.POST("/api/v1/invoices/batch/delete", { body: request }));
    },
    async resetInvoice(invoiceId, version) {
      await get<components["schemas"]["InvoiceResponse"]>(
        client.PUT("/api/v1/invoices/{invoiceId}/reset", {
          body: { version },
          params: { path: { invoiceId } },
        }),
      );
    },
    async resetInvoices(request) {
      await get<unknown>(client.PUT("/api/v1/invoices/batch/reset", { body: request }));
    },
    async updateInvoiceOwner(invoiceId, request) {
      const payload = await get<components["schemas"]["InvoiceResponse"]>(
        client.PUT("/api/v1/invoices/{invoiceId}/owner", {
          body: request,
          params: { path: { invoiceId } },
        }),
      );
      const invoice = toInvoiceListItem(payload);
      if (invoice === null) throw new Error("发票负责人更新响应暂时不可用，请稍后重试。");
      return invoice;
    },
    async updateInvoiceOwners(request) {
      await get<unknown>(client.PUT("/api/v1/invoices/batch/owner", { body: request }));
    },
    getReceivables: (query) =>
      get<components["schemas"]["ReceivablePageResponse"]>(
        client.POST("/api/v1/receivables/query", { body: query }),
      ),
    getReceivableSummary: (query) =>
      get<components["schemas"]["ReceivableListSummaryResponse"]>(
        client.POST("/api/v1/receivables/summary", { body: query }),
      ),
    async getReceivable(receivableId) {
      const payload = await get<components["schemas"]["ReceivableResponse"]>(
        client.GET("/api/v1/receivables/{receivableId}", {
          params: { path: { receivableId } },
        }),
      );
      const receivable = toReceivableListItem(payload);
      if (receivable === null) throw new Error("回款详情数据暂时不可用，请稍后重试。");
      return receivable;
    },
    async createReceivable(request) {
      const payload = await get<components["schemas"]["ReceivableResponse"]>(
        client.POST("/api/v1/receivables", { body: request }),
      );
      const receivable = toReceivableListItem(payload);
      if (receivable === null) throw new Error("新建回款响应暂时不可用，请稍后重试。");
      return receivable;
    },
    async updateReceivable(receivableId, request) {
      const payload = await get<components["schemas"]["ReceivableResponse"]>(
        client.PATCH("/api/v1/receivables/{receivableId}", {
          body: request,
          params: { path: { receivableId } },
        }),
      );
      const receivable = toReceivableListItem(payload);
      if (receivable === null) throw new Error("回款更新响应暂时不可用，请稍后重试。");
      return receivable;
    },
    async updateReceivableOwner(receivableId, request) {
      const payload = await get<components["schemas"]["ReceivableResponse"]>(
        client.PUT("/api/v1/receivables/{receivableId}/owner", {
          body: request,
          params: { path: { receivableId } },
        }),
      );
      const receivable = toReceivableListItem(payload);
      if (receivable === null) throw new Error("回款负责人更新响应暂时不可用，请稍后重试。");
      return receivable;
    },
    async updateReceivableOwners(request) {
      await get<unknown>(client.PUT("/api/v1/receivables/batch/owner", { body: request }));
    },
    async deleteReceivable(receivableId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/receivables/{receivableId}", {
          params: { path: { receivableId }, query: { version } },
        }),
      );
    },
    async deleteReceivables(request) {
      await get<unknown>(client.POST("/api/v1/receivables/batch/delete", { body: request }));
    },
    getReceivablePlans: (query) =>
      get<components["schemas"]["ReceivablePlanPageResponse"]>(
        client.POST("/api/v1/receivable-plans/query", { body: query }),
      ),
    getReceivablePlanSummary: (query) =>
      get<components["schemas"]["ReceivablePlanListSummaryResponse"]>(
        client.POST("/api/v1/receivable-plans/summary", { body: query }),
      ),
    exportReceivablePlansCsv: (request) =>
      getDownload(
        client.POST("/api/v1/receivable-plans/export/csv", {
          body: request,
          parseAs: "blob",
        }),
      ),
    async getVisibleReceivablePlans(query) {
      const payload = await get<components["schemas"]["ReceivablePlanPageResponse"]>(
        client.POST("/api/v1/receivable-plans/query", { body: query }),
      );
      return decodeReceivablePlanOptions(payload);
    },
    async getReceivablePlan(planId) {
      const payload = await get<components["schemas"]["ReceivablePlanResponse"]>(
        client.GET("/api/v1/receivable-plans/{planId}", { params: { path: { planId } } }),
      );
      const plan = toReceivablePlanListItem(payload);
      if (plan === null) throw new Error("回款计划详情数据暂时不可用，请稍后重试。");
      return plan;
    },
    async getVisibleReceivablePlan(planId) {
      const payload = await get<components["schemas"]["ReceivablePlanResponse"]>(
        client.GET("/api/v1/receivable-plans/{planId}", { params: { path: { planId } } }),
      );
      const plan = toReceivablePlanListItem(payload);
      if (plan === null) throw new Error("回款计划详情数据暂时不可用，请稍后重试。");
      return toReceivablePlanOption(plan);
    },
    getWorkTasks: (query) =>
      get<components["schemas"]["WorkTaskPageResponse"]>(
        client.POST("/api/v1/work/tasks/query", { body: query }),
      ),
    async getWorklist(query) {
      const payload = await get<unknown>(client.GET("/api/v1/worklist", { params: { query } }));
      const page = toWorklistPage(payload);
      if (page === null) throw new Error("工作台待办数据暂时不可用，请稍后重试。");
      return page;
    },
    async acknowledgeWorklist(request) {
      await get<unknown>(client.POST("/api/v1/worklist/acknowledgements", { body: request }));
    },
    getWorkTaskSeries: (query) =>
      get<components["schemas"]["WorkTaskSeriesListPageResponse"]>(
        client.GET("/api/v1/work/task-series", { params: { query } }),
      ),
    async getWorkTaskSeriesDetail(seriesId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/work/task-series/{seriesId}", { params: { path: { seriesId } } }),
      );
      const series = toWorkTaskSeriesDetail(payload);
      if (series === null || series.id !== seriesId) {
        throw new Error("周期任务编辑基线暂时不可用，请稍后重试。");
      }
      return series;
    },
    async createWorkTaskSeries(request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/work/task-series", { body: request }),
      );
      const result = toWorkTaskSeriesMutationResult(payload);
      if (result === null) throw new Error("新建周期任务响应暂时不可用，请稍后重试。");
      return result;
    },
    async updateWorkTaskSeries(seriesId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/work/task-series/{seriesId}", {
          body: request,
          params: { path: { seriesId } },
        }),
      );
      const result = toWorkTaskSeriesMutationResult(payload);
      if (result === null || result.id !== seriesId) {
        throw new Error("周期任务更新响应暂时不可用，请稍后重试。");
      }
      return result;
    },
    async activateWorkTaskSeries(seriesId, version) {
      const payload = await get<unknown>(
        client.POST("/api/v1/work/task-series/{seriesId}/activate", {
          body: { version },
          params: { path: { seriesId } },
        }),
      );
      const result = toWorkTaskSeriesMutationResult(payload);
      if (result === null || result.id !== seriesId || result.status !== "ACTIVE") {
        throw new Error("恢复周期任务响应暂时不可用，请稍后重试。");
      }
      return result;
    },
    async pauseWorkTaskSeries(seriesId, version) {
      const payload = await get<unknown>(
        client.POST("/api/v1/work/task-series/{seriesId}/pause", {
          body: { version },
          params: { path: { seriesId } },
        }),
      );
      const result = toWorkTaskSeriesMutationResult(payload);
      if (result === null || result.id !== seriesId || result.status !== "PAUSED") {
        throw new Error("暂停周期任务响应暂时不可用，请稍后重试。");
      }
      return result;
    },
    async deleteWorkTaskSeries(seriesId, version) {
      const payload = await get<unknown>(
        client.DELETE("/api/v1/work/task-series/{seriesId}", {
          params: { path: { seriesId }, query: { version } },
        }),
      );
      const result = toWorkTaskSeriesMutationResult(payload);
      if (result === null || result.id !== seriesId || result.status !== "STOPPED") {
        throw new Error("停止周期任务响应暂时不可用，请稍后重试。");
      }
      return result;
    },
    getWorkTaskSeriesOccurrences: (seriesId, query) =>
      get<components["schemas"]["WorkTaskSeriesOccurrencePageResponse"]>(
        client.GET("/api/v1/work/task-series/{seriesId}/occurrences", {
          params: { path: { seriesId }, query },
        }),
      ),
    async getWorkTaskSeriesReminderPlan(seriesId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/work/task-series/{seriesId}/reminders", {
          params: { path: { seriesId } },
        }),
      );
      const plan = toWorkTaskSeriesReminderPlan(payload);
      if (plan === null || plan.seriesId !== seriesId) {
        throw new Error("周期任务未来提醒基线暂时不可用，请稍后重试。");
      }
      return plan;
    },
    async getWorkTask(taskId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/work/tasks/{taskId}", { params: { path: { taskId } } }),
      );
      const task = toWorkTaskListItem(payload);
      if (task === null || task.id !== taskId) {
        throw new Error("任务详情数据暂时不可用，请稍后重试。");
      }
      return task;
    },
    async getWorkTaskEditBaseline(taskId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/work/tasks/{taskId}", { params: { path: { taskId } } }),
      );
      const task = toWorkTaskEditBaseline(payload);
      if (task === null || task.id !== taskId) {
        throw new Error("任务编辑基线暂时不可用，请稍后重试。");
      }
      return task;
    },
    async getWorkTaskFollowerBaseline(taskId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/work/tasks/{taskId}", { params: { path: { taskId } } }),
      );
      const task = toWorkTaskFollowerBaseline(payload);
      if (task === null || task.id !== taskId) {
        throw new Error("任务关注人基线暂时不可用，请稍后重试。");
      }
      return task;
    },
    async getWorkTaskReminderPlan(taskId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/work/tasks/{taskId}/reminders", { params: { path: { taskId } } }),
      );
      const plan = toWorkTaskReminderPlan(payload);
      if (plan === null || plan.taskId !== taskId) {
        throw new Error("任务提醒基线暂时不可用，请稍后重试。");
      }
      return plan;
    },
    getWorkTaskAttachments: (taskId, query) =>
      get<components["schemas"]["AttachmentPageResponse"]>(
        client.GET("/api/v1/attachment-targets/{targetType}/{targetId}/attachments", {
          params: { path: { targetId: taskId, targetType: "work-task" }, query },
        }),
      ),
    async createWorkTask(request) {
      const payload = await get<unknown>(client.POST("/api/v1/work/tasks", { body: request }));
      const task = toWorkTaskListItem(payload);
      if (task === null) throw new Error("新建任务响应暂时不可用，请稍后重试。");
      return task;
    },
    async updateWorkTask(taskId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/work/tasks/{taskId}", {
          body: request,
          params: { path: { taskId } },
        }),
      );
      const task = toWorkTaskListItem(payload);
      if (task === null || task.id !== taskId) {
        throw new Error("任务结构更新响应暂时不可用，请稍后重试。");
      }
      return task;
    },
    async updateWorkTaskAssignee(taskId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/work/tasks/{taskId}/assignee", {
          body: request,
          params: { path: { taskId } },
        }),
      );
      const task = toWorkTaskListItem(payload);
      if (task === null || task.id !== taskId) {
        throw new Error("任务处理人更新响应暂时不可用，请稍后重试。");
      }
      return task;
    },
    async replaceWorkTaskFollowers(taskId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/work/tasks/{taskId}/followers", {
          body: request,
          params: { path: { taskId } },
        }),
      );
      const task = toWorkTaskListItem(payload);
      if (task === null || task.id !== taskId) {
        throw new Error("任务关注人更新响应暂时不可用，请稍后重试。");
      }
      return task;
    },
    async replaceWorkTaskReminderPlan(taskId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/work/tasks/{taskId}/reminders", {
          body: request,
          params: { path: { taskId } },
        }),
      );
      const plan = toWorkTaskReminderPlan(payload);
      if (plan === null || plan.taskId !== taskId) {
        throw new Error("任务提醒更新响应暂时不可用，请稍后重试。");
      }
      return plan;
    },
    async replaceWorkTaskSeriesReminderPlan(seriesId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/work/task-series/{seriesId}/reminders", {
          body: request,
          params: { path: { seriesId } },
        }),
      );
      const plan = toWorkTaskSeriesReminderPlan(payload);
      if (plan === null || plan.seriesId !== seriesId) {
        throw new Error("周期任务未来提醒更新响应暂时不可用，请稍后重试。");
      }
      return plan;
    },
    async updateWorkTaskBusinessRecord(taskId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/work/tasks/{taskId}/business-record", {
          body: request,
          params: { path: { taskId } },
        }),
      );
      const task = toWorkTaskListItem(payload);
      if (task === null || task.id !== taskId) {
        throw new Error("任务业务关联更新响应暂时不可用，请稍后重试。");
      }
      return task;
    },
    async clearWorkTaskBusinessRecord(taskId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/work/tasks/{taskId}/business-record", {
          body: request,
          params: { path: { taskId } },
        }),
      );
      const task = toWorkTaskListItem(payload);
      if (task === null || task.id !== taskId) {
        throw new Error("任务业务关联更新响应暂时不可用，请稍后重试。");
      }
      return task;
    },
    async startWorkTask(taskId, request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/work/tasks/{taskId}/start", {
          body: request,
          params: { path: { taskId } },
        }),
      );
      const task = toWorkTaskListItem(payload);
      if (task === null || task.id !== taskId) {
        throw new Error("开始任务响应暂时不可用，请稍后重试。");
      }
      return task;
    },
    async returnWorkTaskToTodo(taskId, request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/work/tasks/{taskId}/return-to-todo", {
          body: request,
          params: { path: { taskId } },
        }),
      );
      const task = toWorkTaskListItem(payload);
      if (task === null || task.id !== taskId) {
        throw new Error("退回待办响应暂时不可用，请稍后重试。");
      }
      return task;
    },
    async completeWorkTask(taskId, request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/work/tasks/{taskId}/complete", {
          body: request,
          params: { path: { taskId } },
        }),
      );
      const task = toWorkTaskListItem(payload);
      if (task === null || task.id !== taskId) {
        throw new Error("完成任务响应暂时不可用，请稍后重试。");
      }
      return task;
    },
    async cancelWorkTask(taskId, request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/work/tasks/{taskId}/cancel", {
          body: request,
          params: { path: { taskId } },
        }),
      );
      const task = toWorkTaskListItem(payload);
      if (task === null || task.id !== taskId) {
        throw new Error("取消任务响应暂时不可用，请稍后重试。");
      }
      return task;
    },
    async deleteWorkTask(taskId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/work/tasks/{taskId}", {
          params: { path: { taskId }, query: { version } },
        }),
      );
    },
    getWorkTaskComments: (taskId, query) =>
      get<components["schemas"]["WorkTaskCommentPageResponse"]>(
        client.GET("/api/v1/work/tasks/{taskId}/comments", {
          params: { path: { taskId }, query },
        }),
      ),
    async createWorkTaskComment(taskId, request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/work/tasks/{taskId}/comments", {
          body: request,
          params: { path: { taskId } },
        }),
      );
      const comment = toWorkTaskCommentListItem(payload);
      if (comment === null || comment.taskId !== taskId) {
        throw new Error("发表评论响应暂时不可用，请稍后重试。");
      }
      return comment;
    },
    async getAvailableReceivablePlans(contractId) {
      const payload = await get<components["schemas"]["ReceivablePlanResponse"][]>(
        client.GET("/api/v1/receivable-plans/available", {
          params: { query: { contractId } },
        }),
      );
      if (!Array.isArray(payload)) {
        throw new Error("可关联回款计划暂时不可用，请稍后重试。");
      }
      const plans: ReceivablePlanSelectionItem[] = [];
      for (const item of payload) {
        const plan = toReceivablePlanListItem(item);
        const selection = plan === null ? null : toReceivablePlanSelectionItem(plan);
        if (selection === null) {
          throw new Error("可关联回款计划暂时不可用，请稍后重试。");
        }
        plans.push(selection);
      }
      return plans;
    },
    async createReceivablePlan(request) {
      const payload = await get<components["schemas"]["ReceivablePlanResponse"]>(
        client.POST("/api/v1/receivable-plans", { body: request }),
      );
      const plan = toReceivablePlanListItem(payload);
      if (plan === null) throw new Error("新建回款计划响应暂时不可用，请稍后重试。");
      return plan;
    },
    async createReceivablePlansBatch(request) {
      const payload = await get<components["schemas"]["ReceivablePlanResponse"][]>(
        client.POST("/api/v1/receivable-plans/batch", { body: request }),
      );
      if (!Array.isArray(payload)) {
        throw new Error("批量新建回款计划响应暂时不可用，请稍后重试。");
      }
      const plans: ReceivablePlanListItem[] = [];
      for (const item of payload) {
        const plan = toReceivablePlanListItem(item);
        if (plan === null) {
          throw new Error("批量新建回款计划响应暂时不可用，请稍后重试。");
        }
        plans.push(plan);
      }
      return plans;
    },
    async updateReceivablePlan(planId, request) {
      const payload = await get<components["schemas"]["ReceivablePlanResponse"]>(
        client.PATCH("/api/v1/receivable-plans/{planId}", {
          body: request,
          params: { path: { planId } },
        }),
      );
      const plan = toReceivablePlanListItem(payload);
      if (plan === null) throw new Error("回款计划更新响应暂时不可用，请稍后重试。");
      return plan;
    },
    async deleteReceivablePlan(planId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/receivable-plans/{planId}", {
          params: { path: { planId }, query: { version } },
        }),
      );
    },
    async createInvoiceProfile(request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/invoice-profiles", { body: request }),
      );
      const profile = toInvoiceProfileListItem(payload);
      if (profile === null) throw new Error("新建开票资料响应暂时不可用，请稍后重试。");
      return profile;
    },
    async updateInvoiceProfile(profileId, request) {
      const payload = await get<unknown>(
        client.PATCH("/api/v1/invoice-profiles/{profileId}", {
          body: request,
          params: { path: { profileId } },
        }),
      );
      const profile = toInvoiceProfileListItem(payload);
      if (profile === null) throw new Error("更新开票资料响应暂时不可用，请稍后重试。");
      return profile;
    },
    async deleteInvoiceProfile(profileId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/invoice-profiles/{profileId}", {
          params: { path: { profileId }, query: { version } },
        }),
      );
    },
    getCustomerPoolCatalog: () =>
      get<components["schemas"]["CustomerPoolResponse"][]>(
        client.GET("/api/v1/customer-pools/catalog", {}),
      ),
    getCustomerPoolConfigurations: (query) =>
      get<components["schemas"]["CustomerPoolPageResponse"]>(
        client.GET("/api/v1/customer-pools", { params: { query } }),
      ),
    createCustomerPool: (request) =>
      get<components["schemas"]["CustomerPoolResponse"]>(
        client.POST("/api/v1/customer-pools", { body: request }),
      ),
    updateCustomerPool: (poolId, request) =>
      get<components["schemas"]["CustomerPoolResponse"]>(
        client.PUT("/api/v1/customer-pools/{poolId}", {
          params: { path: { poolId } },
          body: request,
        }),
      ),
    updateCustomerPoolStatus: (poolId, request) =>
      get<components["schemas"]["CustomerPoolResponse"]>(
        client.PUT("/api/v1/customer-pools/{poolId}/status", {
          params: { path: { poolId } },
          body: request,
        }),
      ),
    async transferCustomerPool(poolId, request) {
      await get<unknown>(
        client.POST("/api/v1/customer-pools/{poolId}/transfer", {
          params: { path: { poolId } },
          body: request,
        }),
      );
    },
    async deleteCustomerPool(poolId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/customer-pools/{poolId}", {
          params: { path: { poolId }, query: { version } },
        }),
      );
    },
    getCustomerPoolCustomers: (poolId, query) =>
      get<components["schemas"]["CustomerPoolCustomerPageResponse"]>(
        client.GET("/api/v1/customer-pools/{poolId}/customers", {
          params: { path: { poolId }, query: { request: query } },
          querySerializer: ({ request }) => serializeRequestQuery(request),
        }),
      ),
    releaseCustomerToPool: (poolId, request) =>
      get<components["schemas"]["CustomerResponse"][]>(
        client.POST("/api/v1/customer-pools/{poolId}/customers/release", {
          params: { path: { poolId } },
          body: request,
        }),
      ),
    claimCustomerFromPool: (poolId, request) =>
      get<components["schemas"]["CustomerResponse"][]>(
        client.POST("/api/v1/customer-pools/{poolId}/customers/claim", {
          params: { path: { poolId } },
          body: request,
        }),
      ),
    assignCustomerFromPool: (poolId, request) =>
      get<components["schemas"]["CustomerResponse"][]>(
        client.POST("/api/v1/customer-pools/{poolId}/customers/assign", {
          params: { path: { poolId } },
          body: request,
        }),
      ),
    async deleteCustomerFromPool(poolId, request) {
      await get<unknown>(
        client.DELETE("/api/v1/customer-pools/{poolId}/customers", {
          params: { path: { poolId } },
          body: request,
        }),
      );
    },
    async getContactPoolCatalog() {
      const payload = await get<unknown>(client.GET("/api/v1/contact-pools/catalog", {}));
      return decodeContactPoolCatalog(payload);
    },
    getContactPoolConfigurations: (query) =>
      get<components["schemas"]["Pager"]>(
        client.GET("/api/v1/contact-pools", { params: { query } }),
      ),
    async createContactPool(request) {
      await get<unknown>(client.POST("/api/v1/contact-pools", { body: request }));
    },
    async updateContactPool(poolId, request) {
      await get<unknown>(
        client.PUT("/api/v1/contact-pools/{poolId}", {
          params: { path: { poolId } },
          body: request,
        }),
      );
    },
    async updateContactPoolStatus(poolId, request) {
      await get<unknown>(
        client.PUT("/api/v1/contact-pools/{poolId}/status", {
          params: { path: { poolId } },
          body: request,
        }),
      );
    },
    async transferContactPool(poolId, request) {
      await get<unknown>(
        client.POST("/api/v1/contact-pools/{poolId}/transfer", {
          params: { path: { poolId } },
          body: request,
        }),
      );
    },
    async deleteContactPool(poolId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/contact-pools/{poolId}", {
          params: { path: { poolId }, query: { version } },
        }),
      );
    },
    getContactPoolContacts: (poolId, query) =>
      get<components["schemas"]["Pager"]>(
        client.GET("/api/v1/contact-pools/{poolId}/contacts", {
          params: { path: { poolId }, query: { request: query } },
          querySerializer: ({ request }) => serializeRequestQuery(request),
        }),
      ),
    async releaseContactToPool(poolId, request) {
      await get<unknown>(
        client.POST("/api/v1/contact-pools/{poolId}/contacts/release", {
          params: { path: { poolId } },
          body: request,
        }),
      );
    },
    async claimContactFromPool(poolId, request) {
      await get<unknown>(
        client.POST("/api/v1/contact-pools/{poolId}/contacts/claim", {
          params: { path: { poolId } },
          body: request,
        }),
      );
    },
    async assignContactFromPool(poolId, request) {
      await get<unknown>(
        client.POST("/api/v1/contact-pools/{poolId}/contacts/assign", {
          params: { path: { poolId } },
          body: request,
        }),
      );
    },
    async deleteContactFromPool(poolId, request) {
      await get<unknown>(
        client.DELETE("/api/v1/contact-pools/{poolId}/contacts", {
          params: { path: { poolId } },
          body: request,
        }),
      );
    },
    async getContact(contactId) {
      const payload = await get<components["schemas"]["ContactResponse"]>(
        client.GET("/api/v1/contacts/{contactId}", { params: { path: { contactId } } }),
      );
      const contact = toContactDetail(payload);
      if (contact === null) throw new Error("联系人详情数据暂时不可用，请稍后重试。");
      return contact;
    },
    async getContactTagCatalog() {
      const payload = await get<unknown>(client.GET("/api/v1/contacts/tags", {}));
      return decodeContactTagCatalog(payload);
    },
    async getContactCollaboratorBaseline(contactId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/contacts/{contactId}/collaborators", {
          params: { path: { contactId } },
        }),
      );
      return decodeContactCollaboratorBaseline(payload);
    },
    async getContactHierarchy(contactId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/contacts/{contactId}/hierarchy", {
          params: { path: { contactId } },
        }),
      );
      const hierarchy = toContactHierarchy(payload, contactId);
      if (hierarchy === null) throw new Error("联系人层级数据暂时不可用，请稍后重试。");
      return hierarchy;
    },
    exportContactsCsv: (request) =>
      getDownload(
        client.POST("/api/v1/contacts/export/csv", {
          body: request,
          parseAs: "blob",
        }),
      ),
    async checkContactDuplicate(request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/contacts/duplicate-check", { body: request }),
      );
      const duplicate =
        payload !== null && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).duplicate
          : undefined;
      if (typeof duplicate !== "boolean") {
        throw new Error("联系人查重响应暂时不可用，请稍后重试。");
      }
      return duplicate;
    },
    async createContact(request) {
      const payload = await get<components["schemas"]["ContactResponse"]>(
        client.POST("/api/v1/contacts", { body: request }),
      );
      const contact = toContactDetail(payload);
      if (contact === null) throw new Error("新建联系人响应暂时不可用，请稍后重试。");
      return contact;
    },
    async updateContact(contactId, request) {
      const payload = await get<components["schemas"]["ContactResponse"]>(
        client.PUT("/api/v1/contacts/{contactId}", {
          params: { path: { contactId } },
          body: request,
        }),
      );
      const contact = toContactDetail(payload);
      if (contact === null) throw new Error("更新联系人响应暂时不可用，请稍后重试。");
      return contact;
    },
    async setContactStarred(contactId, request) {
      await get<unknown>(
        client.PUT("/api/v1/contacts/{contactId}/star", {
          params: { path: { contactId } },
          body: request,
        }),
      );
    },
    async updateContactState(contactId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/contacts/{contactId}/state", {
          params: { path: { contactId } },
          body: request,
        }),
      );
      const contact = toContactDetail(payload);
      if (contact === null) throw new Error("更新联系人状态响应暂时不可用，请稍后重试。");
      return contact;
    },
    async replaceContactTags(contactId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/contacts/{contactId}/tags", {
          params: { path: { contactId } },
          body: request,
        }),
      );
      const contact = toContactDetail(payload);
      if (contact === null) throw new Error("更新联系人标签响应暂时不可用，请稍后重试。");
      return contact;
    },
    async changeContactTags(request) {
      await get<void>(
        client.POST("/api/v1/contacts/batch/tags", {
          body: request,
        }),
      );
    },
    async updateContactOwners(request) {
      await get<void>(
        client.PUT("/api/v1/contacts/batch/owner", {
          body: request,
        }),
      );
    },
    async deleteContacts(request) {
      await get<void>(
        client.POST("/api/v1/contacts/batch/delete", {
          body: request,
        }),
      );
    },
    async updateContactParent(contactId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/contacts/{contactId}/parent", {
          params: { path: { contactId } },
          body: request,
        }),
      );
      const contact = toContactDetail(payload);
      if (contact === null) throw new Error("更新联系人层级响应暂时不可用，请稍后重试。");
      return contact;
    },
    async updateContactOwner(contactId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/contacts/{contactId}/owner", {
          params: { path: { contactId } },
          body: request,
        }),
      );
      const contact = toContactDetail(payload);
      if (contact === null) throw new Error("更新联系人负责人响应暂时不可用，请稍后重试。");
      return contact;
    },
    async replaceContactCollaborators(contactId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/contacts/{contactId}/collaborators", {
          params: { path: { contactId } },
          body: request,
        }),
      );
      const contact = toContactDetail(payload);
      if (contact === null) throw new Error("更新联系人协作者响应暂时不可用，请稍后重试。");
      return contact;
    },
    async exitContactCollaborator(contactId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/contacts/{contactId}/collaborators/me", {
          params: { path: { contactId }, query: { version } },
        }),
      );
    },
    async deleteContact(contactId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/contacts/{contactId}", {
          params: { path: { contactId }, query: { version } },
        }),
      );
    },
    async getCustomer(customerId) {
      const payload = await get<components["schemas"]["CustomerResponse"]>(
        client.GET("/api/v1/customers/{customerId}", { params: { path: { customerId } } }),
      );
      const customer = toCustomerDetail(payload);
      if (customer === null) throw new Error("客户详情数据暂时不可用，请稍后重试。");
      return customer;
    },
    async getCustomerBusinessOverview(customerId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/customers/{customerId}/business-overview", {
          params: { path: { customerId } },
        }),
      );
      const overview = toCustomerBusinessOverview(payload, customerId);
      if (overview === null) throw new Error("客户业务概览数据暂时不可用，请稍后重试。");
      return overview;
    },
    async getCustomerCollaboratorBaseline(customerId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/customers/{customerId}/collaborators", {
          params: { path: { customerId } },
        }),
      );
      return decodeCustomerCollaboratorBaseline(payload);
    },
    async getCustomerHierarchy(customerId) {
      const payload = await get<unknown>(
        client.GET("/api/v1/customers/{customerId}/hierarchy", {
          params: { path: { customerId } },
        }),
      );
      const hierarchy = toCustomerHierarchy(payload, customerId);
      if (hierarchy === null) throw new Error("客户层级数据暂时不可用，请稍后重试。");
      return hierarchy;
    },
    async getCustomerTagCatalog() {
      const payload = await get<unknown>(client.GET("/api/v1/customers/tags", {}));
      return decodeCustomerTagCatalog(payload);
    },
    updateMyProfile: (request) =>
      get<components["schemas"]["MemberProfileResponse"]>(
        client.PUT("/api/v1/organization/profile", { body: request }),
      ),
    async getVisibleMembers(query) {
      const payload = await get<unknown>(
        client.GET("/api/v1/organization/members", {
          params: { query: { request: query } },
          querySerializer: ({ request }) => serializeRequestQuery(request),
        }),
      );
      return decodeMemberOptions(payload);
    },
    async getVisibleDepartments() {
      const payload = await get<unknown>(client.GET("/api/v1/organization/departments", {}));
      return decodeDepartmentOptions(payload);
    },
    getOrganizationDepartments: () =>
      get<components["schemas"]["DepartmentResponse"][]>(
        client.GET("/api/v1/organization/departments", {}),
      ),
    createOrganizationDepartment: (request) =>
      get<components["schemas"]["DepartmentResponse"]>(
        client.POST("/api/v1/organization/departments", { body: request }),
      ),
    renameOrganizationDepartment: (departmentId, request) =>
      get<components["schemas"]["DepartmentResponse"]>(
        client.PUT("/api/v1/organization/departments/{departmentId}/name", {
          body: request,
          params: { path: { departmentId } },
        }),
      ),
    moveOrganizationDepartment: (departmentId, request) =>
      get<components["schemas"]["DepartmentResponse"]>(
        client.PUT("/api/v1/organization/departments/{departmentId}/parent", {
          body: request,
          params: { path: { departmentId } },
        }),
      ),
    deactivateOrganizationDepartment: async (departmentId) => {
      await get<void>(
        client.POST("/api/v1/organization/departments/{departmentId}/deactivate", {
          params: { path: { departmentId } },
        }),
      );
    },
    deleteOrganizationDepartment: async (departmentId) => {
      await get<void>(
        client.DELETE("/api/v1/organization/departments/{departmentId}", {
          params: { path: { departmentId } },
        }),
      );
    },
    getOrganizationMembers: (request) =>
      get<components["schemas"]["MemberProfilePageResponse"]>(
        client.GET("/api/v1/organization/members", {
          params: { query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    getOrganizationDepartmentMembers: (departmentId, request) =>
      get<components["schemas"]["DepartmentMemberProfilePageResponse"]>(
        client.GET("/api/v1/organization/departments/{departmentId}/members", {
          params: { path: { departmentId }, query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    getUsers: (request) =>
      get<components["schemas"]["UserPageResponse"]>(
        client.GET("/api/v1/users", {
          params: { query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    createUser: (request) =>
      get<components["schemas"]["UserResponse"]>(client.POST("/api/v1/users", { body: request })),
    async updateUserStatus(userId, status) {
      await get<void>(
        client.PUT("/api/v1/users/{userId}/status", {
          params: { path: { userId }, query: { status } },
        }),
      );
    },
    async deleteUser(userId) {
      await get<void>(client.DELETE("/api/v1/users/{userId}", { params: { path: { userId } } }));
    },
    submitMembershipRequest: (request) =>
      get<components["schemas"]["MembershipRequestResponse"]>(
        client.POST("/api/v1/organization/membership-requests", { body: request }),
      ),
    async withdrawMembershipRequest(requestId) {
      await get<void>(
        client.POST("/api/v1/organization/membership-requests/{requestId}/withdraw", {
          params: { path: { requestId } },
        }),
      );
    },
    getMyMembershipRequests: (request) =>
      get<components["schemas"]["MembershipRequestPageResponse"]>(
        client.GET("/api/v1/organization/membership-requests/mine", {
          params: { query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    getMembershipRequests: (request) =>
      get<components["schemas"]["MembershipRequestPageResponse"]>(
        client.GET("/api/v1/organization/membership-requests", {
          params: { query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    approveMembershipRequest: async (requestId) => {
      await get<void>(
        client.POST("/api/v1/organization/membership-requests/{requestId}/approve", {
          params: { path: { requestId } },
        }),
      );
    },
    rejectMembershipRequest: async (requestId) => {
      await get<void>(
        client.POST("/api/v1/organization/membership-requests/{requestId}/reject", {
          params: { path: { requestId } },
        }),
      );
    },
    getAuthorizationCapabilities: () =>
      get<components["schemas"]["AuthorityCapabilityResponse"][]>(
        client.GET("/api/v1/authorization/capabilities", {}),
      ),
    getTenantRoles: (request) =>
      get<components["schemas"]["TenantRolePageResponse"]>(
        client.GET("/api/v1/authorization/roles", {
          params: { query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    createTenantRole: (request) =>
      get<components["schemas"]["TenantRoleResponse"]>(
        client.POST("/api/v1/authorization/roles", { body: request }),
      ),
    updateTenantRole: (roleId, request) =>
      get<components["schemas"]["TenantRoleResponse"]>(
        client.PUT("/api/v1/authorization/roles/{roleId}", {
          body: request,
          params: { path: { roleId } },
        }),
      ),
    copyTenantRole: (roleId, request) =>
      get<components["schemas"]["TenantRoleResponse"]>(
        client.POST("/api/v1/authorization/roles/{roleId}/copy", {
          body: request,
          params: { path: { roleId } },
        }),
      ),
    replaceTenantRoleGrants: (roleId, request) =>
      get<components["schemas"]["TenantRoleResponse"]>(
        client.PUT("/api/v1/authorization/roles/{roleId}/grants", {
          body: request,
          params: { path: { roleId } },
        }),
      ),
    deleteTenantRole: async (roleId, version) => {
      await get<void>(
        client.DELETE("/api/v1/authorization/roles/{roleId}", {
          params: { path: { roleId }, query: { version } },
        }),
      );
    },
    getTenantRoleAssignments: (roleId, request) =>
      get<components["schemas"]["RoleAssignmentPageResponse"]>(
        client.GET("/api/v1/authorization/roles/{roleId}/assignments", {
          params: { path: { roleId }, query: { request } },
          querySerializer: ({ request: query }) => serializeRequestQuery(query),
        }),
      ),
    assignTenantRole: async (roleId, request) => {
      await get<void>(
        client.POST("/api/v1/authorization/roles/{roleId}/assignments", {
          body: request,
          params: { path: { roleId } },
        }),
      );
    },
    removeTenantRoleAssignment: async (roleId, actorId) => {
      await get<void>(
        client.DELETE("/api/v1/authorization/roles/{roleId}/assignments/{actorId}", {
          params: { path: { actorId, roleId } },
        }),
      );
    },
    getCustomizableBusinessObjects: () =>
      get<components["schemas"]["BusinessObjectResponse"][]>(
        client.GET("/api/v1/fields/objects", {}),
      ),
    listFieldDefinitions: (objectType, includeInactive) =>
      get<components["schemas"]["FieldDefinitionResponse"][]>(
        client.GET("/api/v1/fields/objects/{objectType}", {
          params: { path: { objectType }, query: { includeInactive } },
        }),
      ),
    createFieldDefinition: (objectType, request) =>
      get<components["schemas"]["FieldDefinitionResponse"]>(
        client.POST("/api/v1/fields/objects/{objectType}", {
          body: request,
          params: { path: { objectType } },
        }),
      ),
    updateFieldDefinition: (objectType, fieldId, request) =>
      get<components["schemas"]["FieldDefinitionResponse"]>(
        client.PUT("/api/v1/fields/objects/{objectType}/{fieldId}", {
          body: request,
          params: { path: { fieldId, objectType } },
        }),
      ),
    deactivateFieldDefinition: async (objectType, fieldId, version) => {
      await get<void>(
        client.DELETE("/api/v1/fields/objects/{objectType}/{fieldId}", {
          params: { path: { fieldId, objectType }, query: { version } },
        }),
      );
    },
    getFieldLayoutDefinition: (objectType) =>
      get<components["schemas"]["FieldLayoutResponse"]>(
        client.GET("/api/v1/fields/objects/{objectType}/layout", {
          params: { path: { objectType } },
        }),
      ),
    updateFieldLayoutDefinition: (objectType, request) =>
      get<components["schemas"]["FieldLayoutResponse"]>(
        client.PUT("/api/v1/fields/objects/{objectType}/layout", {
          body: request,
          params: { path: { objectType } },
        }),
      ),
    getRoleFieldPolicy: (roleId, objectType) =>
      get<components["schemas"]["RoleFieldPolicyResponse"]>(
        client.GET("/api/v1/fields/roles/{roleId}/objects/{objectType}/access", {
          params: { path: { objectType, roleId } },
        }),
      ),
    replaceRoleFieldPolicy: (roleId, objectType, request) =>
      get<components["schemas"]["RoleFieldPolicyResponse"]>(
        client.PUT("/api/v1/fields/roles/{roleId}/objects/{objectType}/access", {
          body: request,
          params: { path: { objectType, roleId } },
        }),
      ),
    listSavedViews: (objectType, includeHidden) =>
      get<components["schemas"]["SavedViewResponse"][]>(
        client.GET("/api/v1/saved-views", {
          params: { query: { includeHidden, objectType } },
        }),
      ),
    createSavedView: (request) =>
      get<components["schemas"]["SavedViewResponse"]>(
        client.POST("/api/v1/saved-views", { body: request }),
      ),
    updateSavedView: (viewId, request) =>
      get<components["schemas"]["SavedViewResponse"]>(
        client.PUT("/api/v1/saved-views/{viewId}", {
          body: request,
          params: { path: { viewId } },
        }),
      ),
    deleteSavedView: async (viewId, version) => {
      await get<void>(
        client.DELETE("/api/v1/saved-views/{viewId}", {
          params: { path: { viewId }, query: { version } },
        }),
      );
    },
    setDefaultSavedView: (viewId, version) =>
      get<components["schemas"]["SavedViewResponse"]>(
        client.PUT("/api/v1/saved-views/{viewId}/default", {
          params: { path: { viewId }, query: { version } },
        }),
      ),
    async checkCustomerDuplicate(request) {
      const payload = await get<unknown>(
        client.POST("/api/v1/customers/duplicate-check", { body: request }),
      );
      const duplicate =
        payload !== null && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).duplicate
          : undefined;
      if (typeof duplicate !== "boolean") {
        throw new Error("客户查重响应暂时不可用，请稍后重试。");
      }
      return duplicate;
    },
    async createCustomer(request) {
      const payload = await get<components["schemas"]["CustomerResponse"]>(
        client.POST("/api/v1/customers", { body: request }),
      );
      const customer = toCustomerDetail(payload);
      if (customer === null) throw new Error("新建客户响应暂时不可用，请稍后重试。");
      return customer;
    },
    async updateCustomer(customerId, request) {
      const payload = await get<components["schemas"]["CustomerResponse"]>(
        client.PUT("/api/v1/customers/{customerId}", {
          params: { path: { customerId } },
          body: request,
        }),
      );
      const customer = toCustomerDetail(payload);
      if (customer === null) throw new Error("更新客户响应暂时不可用，请稍后重试。");
      return customer;
    },
    async updateCustomerOwner(customerId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/customers/{customerId}/owner", {
          params: { path: { customerId } },
          body: request,
        }),
      );
      const customer = toCustomerDetail(payload);
      if (customer === null) throw new Error("更新客户负责人响应暂时不可用，请稍后重试。");
      return customer;
    },
    async replaceCustomerCollaborators(customerId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/customers/{customerId}/collaborators", {
          params: { path: { customerId } },
          body: request,
        }),
      );
      const customer = toCustomerDetail(payload);
      if (customer === null) throw new Error("更新客户协作者响应暂时不可用，请稍后重试。");
      return customer;
    },
    async exitCustomerCollaborator(customerId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/customers/{customerId}/collaborators/me", {
          params: { path: { customerId }, query: { version } },
        }),
      );
    },
    async updateCustomerParent(customerId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/customers/{customerId}/parent", {
          params: { path: { customerId } },
          body: request,
        }),
      );
      const customer = toCustomerDetail(payload);
      if (customer === null) throw new Error("更新客户层级响应暂时不可用，请稍后重试。");
      return customer;
    },
    async updateCustomerState(customerId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/customers/{customerId}/state", {
          params: { path: { customerId } },
          body: request,
        }),
      );
      const customer = toCustomerDetail(payload);
      if (customer === null) throw new Error("更新客户状态响应暂时不可用，请稍后重试。");
      return customer;
    },
    async replaceCustomerTags(customerId, request) {
      const payload = await get<unknown>(
        client.PUT("/api/v1/customers/{customerId}/tags", {
          params: { path: { customerId } },
          body: request,
        }),
      );
      const customer = toCustomerDetail(payload);
      if (customer === null) throw new Error("更新客户标签响应暂时不可用，请稍后重试。");
      return customer;
    },
    async changeCustomerTags(request) {
      await get<void>(
        client.POST("/api/v1/customers/batch/tags", {
          body: request,
        }),
      );
    },
    async deleteCustomer(customerId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/customers/{customerId}", {
          params: { path: { customerId }, query: { version } },
        }),
      );
    },
    exportCustomersCsv: (request) =>
      getDownload(
        client.POST("/api/v1/customers/export/csv", {
          body: request,
          parseAs: "blob",
        }),
      ),
    async setCustomerStarred(customerId, request) {
      await get<unknown>(
        client.PUT("/api/v1/customers/{customerId}/star", {
          params: { path: { customerId } },
          body: request,
        }),
      );
    },
    async getFieldDefinitions(objectType) {
      const payload = await get<unknown>(
        client.GET("/api/v1/fields/objects/{objectType}", {
          params: { path: { objectType }, query: { includeInactive: false } },
        }),
      );
      return decodeFieldDefinitions(payload);
    },
    async getFieldLayout(objectType) {
      const payload = await get<unknown>(
        client.GET("/api/v1/fields/objects/{objectType}/layout", {
          params: { path: { objectType } },
        }),
      );
      return decodeFieldLayout(payload);
    },
    createCrmImportDraft: (objectType) =>
      get<components["schemas"]["CrmImportDraftResponse"]>(
        client.POST("/api/v1/crm-import-drafts", { body: { objectType } }),
      ),
    getCrmImportTemplate: (objectType) =>
      get<components["schemas"]["CrmImportTemplateResponse"]>(
        client.GET("/api/v1/crm-import-drafts/templates/{objectType}", {
          params: { path: { objectType } },
        }),
      ),
    getCrmImportHistory: (objectType, page = 1, size = 20) =>
      get<components["schemas"]["CrmImportHistoryPageResponse"]>(
        client.GET("/api/v1/crm-import-drafts/history/{objectType}", {
          params: { path: { objectType }, query: { page, size } },
        }),
      ),
    async uploadCrmImportDraftSource(draftId, file) {
      if (!Number.isSafeInteger(draftId) || draftId <= 0) {
        throw new Error("导入草稿无效，请重新开始导入。");
      }
      if (!validCrmImportSourceFile(file)) {
        throw new Error("请选择不超过 1 MB 的 CSV 文件后重试。");
      }

      const target: ControlledAttachmentTarget = { targetId: draftId, targetType: "import-draft" };
      const declaredMediaType = "text/csv";
      const intent = await get<components["schemas"]["AttachmentUploadIntentResponse"]>(
        client.POST(
          "/api/v1/attachment-targets/{targetType}/{targetId}/attachments/upload-intents",
          {
            body: {
              declaredMediaType,
              displayName: file.name.trim(),
              expectedBytes: file.size,
            },
            params: { path: target },
          },
        ),
      );
      if (!validControlledAttachmentIntent(intent, file, declaredMediaType)) {
        throw new Error("导入文件上传意图暂时不可用，请重新选择文件后重试。");
      }

      await uploadControlledAttachmentContent(target, intent.fileId, intent.version, file);
      const status = await get<components["schemas"]["AttachmentUploadStatusResponse"]>(
        client.GET(
          "/api/v1/attachment-targets/{targetType}/{targetId}/attachments/{fileId}/upload-status",
          { params: { path: { ...target, fileId: intent.fileId } } },
        ),
      );
      return { fileId: intent.fileId, status };
    },
    getCrmImportDraftSourceStatus: (draftId, fileId) =>
      get<components["schemas"]["AttachmentUploadStatusResponse"]>(
        client.GET(
          "/api/v1/attachment-targets/{targetType}/{targetId}/attachments/{fileId}/upload-status",
          { params: { path: { targetId: draftId, targetType: "import-draft", fileId } } },
        ),
      ),
    getCrmImportDraftPreview: (draftId) =>
      get<components["schemas"]["CrmImportPreviewResponse"]>(
        client.GET("/api/v1/crm-import-drafts/{draftId}/preview", {
          params: { path: { draftId } },
        }),
      ),
    downloadCrmImportDraftErrorReport: (draftId) =>
      getDownload(
        client.GET("/api/v1/crm-import-drafts/{draftId}/error-report", {
          params: { path: { draftId } },
          parseAs: "blob",
        }),
      ),
    confirmCrmImportDraft: (draftId, version) =>
      get<components["schemas"]["CrmImportConfirmResponse"]>(
        client.POST("/api/v1/crm-import-drafts/{draftId}/confirm", {
          body: { version },
          params: { path: { draftId } },
        }),
      ),
    async withdrawCrmImportDraft(draftId, version) {
      await get<unknown>(
        client.DELETE("/api/v1/crm-import-drafts/{draftId}", {
          params: { path: { draftId }, query: { version } },
        }),
      );
    },
    getAttachments: (target, query) => {
      if (!validControlledAttachmentTarget(target)) {
        return Promise.reject(new Error("附件所属记录无效，请刷新后重试。"));
      }
      return get<components["schemas"]["AttachmentPageResponse"]>(
        client.GET("/api/v1/attachment-targets/{targetType}/{targetId}/attachments", {
          params: { path: target, query },
        }),
      );
    },
    getAttachmentUploadStatus: (target, fileId) => {
      if (
        !validControlledAttachmentTarget(target) ||
        !Number.isSafeInteger(fileId) ||
        fileId <= 0
      ) {
        return Promise.reject(new Error("附件状态参数无效，请刷新后重试。"));
      }
      return get<components["schemas"]["AttachmentUploadStatusResponse"]>(
        client.GET(
          "/api/v1/attachment-targets/{targetType}/{targetId}/attachments/{fileId}/upload-status",
          { params: { path: { ...target, fileId } } },
        ),
      );
    },
    async uploadAttachments(target, files, options) {
      if (!validControlledAttachmentTarget(target)) {
        throw new Error("附件所属记录无效，请刷新后重试。");
      }
      if (
        options?.marketingActivityImageType !== undefined &&
        target.targetType !== "marketing-activity"
      ) {
        throw new Error("活动图片仅能上传到市场活动记录。");
      }
      if (options?.productImageType !== undefined && target.targetType !== "product") {
        throw new Error("产品图片仅能上传到产品记录。");
      }
      if (
        options?.marketingActivityImageType !== undefined &&
        options.productImageType !== undefined
      ) {
        throw new Error("一次上传只能指定一个图片分组。");
      }
      if (files.length === 0 || files.some((file) => !validUploadFile(file))) {
        throw new Error("请选择名称和大小均有效的文件后再上传。");
      }

      const results: ControlledAttachmentUploadResult[] = [];
      for (const file of files) {
        const declaredMediaType = controlledAttachmentMediaType(file);
        if (declaredMediaType === null) {
          throw new Error("附件仅支持 PDF、PNG、JPG 或 JPEG 格式。");
        }
        if (
          options?.marketingActivityImageType !== undefined &&
          declaredMediaType !== "image/png" &&
          declaredMediaType !== "image/jpeg"
        ) {
          throw new Error("活动图片仅支持 PNG、JPG 或 JPEG 格式。");
        }
        if (
          options?.productImageType !== undefined &&
          declaredMediaType !== "image/png" &&
          declaredMediaType !== "image/jpeg"
        ) {
          throw new Error("产品图片仅支持 PNG、JPG 或 JPEG 格式。");
        }
        const intent = await get<components["schemas"]["AttachmentUploadIntentResponse"]>(
          client.POST(
            "/api/v1/attachment-targets/{targetType}/{targetId}/attachments/upload-intents",
            {
              body: {
                declaredMediaType,
                displayName: file.name.trim(),
                expectedBytes: file.size,
                marketingActivityImageType: options?.marketingActivityImageType,
                productImageType: options?.productImageType,
              },
              params: { path: target },
            },
          ),
        );
        if (!validControlledAttachmentIntent(intent, file, declaredMediaType)) {
          throw new Error("附件上传意图暂时不可用，请重新选择文件后重试。");
        }

        await uploadControlledAttachmentContent(target, intent.fileId, intent.version, file);
        const status = await get<components["schemas"]["AttachmentUploadStatusResponse"]>(
          client.GET(
            "/api/v1/attachment-targets/{targetType}/{targetId}/attachments/{fileId}/upload-status",
            { params: { path: { ...target, fileId: intent.fileId } } },
          ),
        );
        results.push({ fileId: intent.fileId, status });
      }
      return results;
    },
    async withdrawAttachment(request, version) {
      await withdrawControlledAttachment(request, request.fileId, version);
    },
    downloadAttachment: (request) =>
      getDownload(
        client.GET(
          "/api/v1/attachment-targets/{targetType}/{targetId}/attachments/{fileId}/content",
          {
            params: { path: request },
            parseAs: "blob",
          },
        ),
      ),
    downloadFileField: (request) =>
      getDownload(
        client.GET(
          "/api/v1/attachment-targets/{targetType}/{targetId}/file-fields/{fieldCode}/{fileId}/content",
          {
            params: { path: request },
            parseAs: "blob",
          },
        ),
      ),
  };
}
