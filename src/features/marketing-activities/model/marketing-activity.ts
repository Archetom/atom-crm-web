import dayjs, { type Dayjs } from "dayjs";

import type { components } from "~/api/generated/schema";
import {
  normalizePageRequest,
  type PageRequest,
  type PageResult,
} from "~/components/data-view/pagination";

export type MarketingActivity = components["schemas"]["MarketingActivityResponse"];
export type RelatedObjectType = MarketingActivity["relatedObjectType"];
export type RelatedObjectTypeOption =
  components["schemas"]["MarketingActivityRelatedObjectTypeOptionResponse"];
export type MarketingFormTargetObjectType =
  components["schemas"]["MarketingFormResponse"]["targetObjectType"];
export type MarketingFormMode = "EXISTING" | "CREATE";
export const marketingActivityDefaultPageRequest: PageRequest = { page: 1, size: 15 };

/** Draft-only values for an atomic target-matched public form creation path. */
export interface InlineMarketingFormDraft {
  description?: string;
  fieldCodes: string[];
  name: string;
  submitButtonText?: string;
  successMessage?: string;
  title: string;
}

export interface MarketingActivityDraft {
  activityType?: string;
  address?: string;
  budget?: number;
  description?: string;
  marketingForm?: InlineMarketingFormDraft;
  marketingFormId?: number;
  marketingFormMode: MarketingFormMode;
  name: string;
  oneSubmissionPerUser: boolean;
  participantActorIds: number[];
  participantDepartmentIds: number[];
  relatedObjectType?: RelatedObjectType;
  submissionCount: number;
  timeRange?: [Dayjs, Dayjs];
  viewCount: number;
}

function localDateTime(value: Dayjs): string {
  return value.format("YYYY-MM-DDTHH:mm:ss");
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isMarketingFormTargetObjectType(
  relatedObjectType: RelatedObjectType | undefined,
): relatedObjectType is MarketingFormTargetObjectType {
  return relatedObjectType === "CUSTOMER" || relatedObjectType === "LEAD";
}

export function supportsMarketingForm(
  relatedObjectType: RelatedObjectType | undefined,
  relatedObjectTypes: readonly RelatedObjectTypeOption[],
): relatedObjectType is MarketingFormTargetObjectType {
  return (
    isMarketingFormTargetObjectType(relatedObjectType) &&
    relatedObjectTypes.some(
      (option) => option.code === relatedObjectType && option.supportsMarketingForm,
    )
  );
}

/** Uses the reference surface's 15-row default without weakening shared URL bounds. */
export function marketingActivityPageRequestFromSearch(search: URLSearchParams): PageRequest {
  const normalized = normalizePageRequest({
    page: Number.parseInt(search.get("page") ?? "", 10),
    size: Number.parseInt(search.get("size") ?? "", 10),
  });
  return search.has("size")
    ? normalized
    : { ...normalized, size: marketingActivityDefaultPageRequest.size };
}

export function toMarketingActivityDraft(
  source: MarketingActivity | null,
  actorId: number | undefined,
  defaultRelatedObjectType?: RelatedObjectType,
): MarketingActivityDraft {
  return {
    activityType: source?.activityType,
    address: source?.address,
    budget: source?.budget ?? undefined,
    description: source?.description,
    marketingFormId: source?.marketingFormId ?? undefined,
    marketingFormMode: "EXISTING",
    name: source?.name ?? "",
    oneSubmissionPerUser: source?.oneSubmissionPerUser ?? true,
    participantActorIds: source?.participantActorIds ?? (actorId === undefined ? [] : [actorId]),
    participantDepartmentIds: source?.participantDepartmentIds ?? [],
    relatedObjectType: source?.relatedObjectType ?? defaultRelatedObjectType,
    submissionCount: source?.submissionCount ?? 0,
    timeRange: source === null ? undefined : [dayjs(source.startTime), dayjs(source.endTime)],
    viewCount: source?.viewCount ?? 0,
  };
}

export function toMarketingActivityCreateRequest(
  draft: MarketingActivityDraft,
  configuration?: components["schemas"]["MarketingFormConfigurationOptionsResponse"],
  supportsInlineMarketingForm = false,
): components["schemas"]["MarketingActivityCreateRequest"] {
  if (draft.timeRange === undefined) throw new Error("市场活动时间范围不能为空。");
  const relatedObjectType = requiredRelatedObjectType(draft.relatedObjectType);
  const marketingForm =
    draft.marketingFormMode === "CREATE"
      ? toInlineMarketingFormCreateRequest(
          draft,
          configuration,
          relatedObjectType,
          supportsInlineMarketingForm,
        )
      : undefined;
  return {
    activityType: optional(draft.activityType),
    address: optional(draft.address),
    budget: draft.budget,
    description: optional(draft.description),
    endTime: localDateTime(draft.timeRange[1]),
    marketingForm,
    marketingFormId: marketingForm === undefined ? draft.marketingFormId : undefined,
    name: draft.name.trim(),
    oneSubmissionPerUser: draft.oneSubmissionPerUser,
    participantActorIds: draft.participantActorIds,
    participantDepartmentIds: draft.participantDepartmentIds,
    relatedObjectType,
    submissionCount: draft.submissionCount,
    startTime: localDateTime(draft.timeRange[0]),
    viewCount: draft.viewCount,
  };
}

export function toMarketingActivityUpdateRequest(
  draft: MarketingActivityDraft,
  source: MarketingActivity,
): components["schemas"]["MarketingActivityUpdateRequest"] {
  return {
    ...toMarketingActivityCreateRequest({
      ...draft,
      marketingForm: undefined,
      marketingFormMode: "EXISTING",
    }),
    version: source.version,
  };
}

function toInlineMarketingFormCreateRequest(
  draft: MarketingActivityDraft,
  configuration: components["schemas"]["MarketingFormConfigurationOptionsResponse"] | undefined,
  relatedObjectType: RelatedObjectType,
  supportsInlineMarketingForm: boolean,
): components["schemas"]["MarketingFormCreateRequest"] {
  if (!supportsInlineMarketingForm || !isMarketingFormTargetObjectType(relatedObjectType)) {
    throw new Error("当前关联对象不支持公开表单。");
  }
  const marketingForm = draft.marketingForm;
  if (marketingForm === undefined) throw new Error("请填写要随活动创建的公开表单。");
  const fieldCodes = [...new Set(marketingForm.fieldCodes)];
  if (fieldCodes.length === 0 || fieldCodes.length !== marketingForm.fieldCodes.length) {
    throw new Error("请至少选择一个不重复的服务端允许字段。");
  }
  const definitions = new Map(configuration?.fields.map((field) => [field.fieldCode, field]));
  return {
    description: optional(marketingForm.description),
    fields: fieldCodes.map((fieldCode, index) => {
      const definition = definitions.get(fieldCode);
      if (definition === undefined) throw new Error("表单字段目录尚未加载或已更新，请刷新后重试。");
      return {
        fieldCode,
        label: definition.displayName,
        required: definition.required,
        sortOrder: (index + 1) * 10,
      };
    }),
    name: required(marketingForm.name, "请输入表单内部名称。"),
    submitButtonText: optional(marketingForm.submitButtonText),
    successMessage: optional(marketingForm.successMessage),
    targetObjectType: relatedObjectType,
    title: required(marketingForm.title, "请输入公开表单标题。"),
  };
}

function required(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

function requiredRelatedObjectType(value: RelatedObjectType | undefined): RelatedObjectType {
  if (value === undefined) throw new Error("请选择服务端提供的关联对象。");
  return value;
}

export function toMarketingActivityPage(
  response: components["schemas"]["MarketingActivityPageResponse"],
): PageResult<MarketingActivity> {
  return {
    items: response.objectList,
    meta: {},
    page: response.pageNum,
    size: response.pageSize,
    total: response.totalNum,
  };
}

export function relatedObjectTypeLabel(
  type: RelatedObjectType,
  relatedObjectTypes: readonly RelatedObjectTypeOption[],
): string {
  return relatedObjectTypes.find((option) => option.code === type)?.displayName ?? type;
}
