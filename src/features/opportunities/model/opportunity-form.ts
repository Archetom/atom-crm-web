import type { components } from "~/api/generated/schema";
import {
  customFieldFormDefinitions,
  toCustomFieldFormValues,
  type CustomFieldValues,
  type FieldDefinition,
} from "~/components/dynamic-field";
import { recordOf } from "~/shared/utils/decode";

export const maximumOpportunityEstimatedAmount = Number.MAX_SAFE_INTEGER;

export interface OpportunityCreateValues {
  name: string;
  customerId: number;
  contactIds?: readonly number[];
  description?: string;
  estimatedAmount?: number;
  expectedCloseDate?: string;
  nextContactTime?: string;
  ownerActorId?: number;
  pipelineCode: string;
  primaryContactId?: number;
  stageCode: string;
  customFields?: CustomFieldValues;
  fileFieldSubmission?: OpportunityFileFieldSubmission;
}

/** File IDs can only originate from an unexpired server-issued OPPORTUNITY draft. */
export interface OpportunityFileFieldSubmission {
  draftId: number;
  fields: Readonly<Record<string, readonly number[]>>;
}

export interface OpportunityUpdateValues {
  name: string;
  expectedCloseDate?: string;
  estimatedAmount?: number;
  nextContactTime: string;
  description?: string;
}

/**
 * Relationships that were explicitly selected from the current server-visible
 * directories. A pipeline is always paired with its stage so an incomplete
 * local selection can never replace one half of the server-issued baseline.
 */
export interface OpportunityUpdateRelationshipValues {
  customerId?: number;
  pipelineStage?: {
    pipelineCode: string;
    stageCode: string;
  };
}

export interface OpportunityCustomFieldUpdateValues {
  changedCodes: ReadonlySet<string>;
  customFields: CustomFieldValues;
}

export type OpportunityEditableBaseline =
  components["schemas"]["OpportunityEditableBaselineResponse"];

export type CompleteOpportunityEditableBaseline = OpportunityEditableBaseline & {
  editable: true;
  id: number;
  version: number;
  name: string;
  customerId: number;
  pipelineCode: string;
  stageCode: string;
};

function isPositiveIdentifier(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSafeNonNegativeAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= maximumOpportunityEstimatedAmount
  );
}

function isOptionalDate(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isOptionalDateTime(value: unknown): value is string | null | undefined {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))
  );
}

function isOptionalText(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function dateTimeLocalValue(value: string | null | undefined): string {
  const normalized = value?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized) ? normalized.slice(0, 16) : "";
}

/**
 * Accepts a purpose-built full-replacement baseline only when it preserves the
 * no-leak contract. A non-editable result cannot carry any business fields.
 */
export function toOpportunityEditableBaseline(value: unknown): OpportunityEditableBaseline | null {
  const source = recordOf(value);
  if (
    source === null ||
    !isPositiveIdentifier(source.id) ||
    !isVersion(source.version) ||
    typeof source.editable !== "boolean"
  ) {
    return null;
  }

  const businessFieldNames = [
    "name",
    "customerId",
    "pipelineCode",
    "stageCode",
    "expectedCloseDate",
    "estimatedAmount",
    "nextContactTime",
    "description",
  ] as const;
  if (!source.editable) {
    return businessFieldNames.some((fieldName) => fieldName in source)
      ? null
      : { editable: false, id: source.id, version: source.version };
  }

  if (
    typeof source.name !== "string" ||
    source.name.trim().length === 0 ||
    !isPositiveIdentifier(source.customerId) ||
    typeof source.pipelineCode !== "string" ||
    source.pipelineCode.trim().length === 0 ||
    typeof source.stageCode !== "string" ||
    source.stageCode.trim().length === 0 ||
    !isOptionalDate(source.expectedCloseDate) ||
    (source.estimatedAmount !== undefined && !isSafeNonNegativeAmount(source.estimatedAmount)) ||
    !isOptionalDateTime(source.nextContactTime) ||
    !isOptionalText(source.description)
  ) {
    return null;
  }

  return {
    customerId: source.customerId,
    description: source.description,
    editable: true,
    estimatedAmount: source.estimatedAmount,
    expectedCloseDate: source.expectedCloseDate,
    id: source.id,
    name: source.name,
    nextContactTime: source.nextContactTime,
    pipelineCode: source.pipelineCode,
    stageCode: source.stageCode,
    version: source.version,
  };
}

export function isCompleteOpportunityEditableBaseline(
  baseline: OpportunityEditableBaseline,
): baseline is CompleteOpportunityEditableBaseline {
  return baseline.editable;
}

export function opportunityUpdateValuesFromBaseline(
  baseline: CompleteOpportunityEditableBaseline,
): OpportunityUpdateValues {
  return {
    description: baseline.description,
    estimatedAmount: baseline.estimatedAmount,
    expectedCloseDate: baseline.expectedCloseDate,
    name: baseline.name,
    nextContactTime: dateTimeLocalValue(baseline.nextContactTime),
  };
}

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : undefined;
}

function selectedPipelineStage(
  values: OpportunityUpdateRelationshipValues,
): { pipelineCode: string; stageCode: string } | null {
  const selection = values.pipelineStage;
  if (
    selection === undefined ||
    typeof selection.pipelineCode !== "string" ||
    selection.pipelineCode.trim().length === 0 ||
    typeof selection.stageCode !== "string" ||
    selection.stageCode.trim().length === 0
  ) {
    return null;
  }

  return {
    pipelineCode: selection.pipelineCode,
    stageCode: selection.stageCode,
  };
}

/**
 * Sends only values explicitly selected from server-visible directories. Dynamic
 * field values are catalog-backed, and file IDs additionally require one
 * server-issued OPPORTUNITY draft.
 */
export function toOpportunityCreateRequest(
  values: OpportunityCreateValues,
): components["schemas"]["OpportunityCreateRequest"] {
  const contactIds = values.contactIds?.filter(isPositiveIdentifier);
  const uniqueContactIds = contactIds === undefined ? undefined : [...new Set(contactIds)];
  const expectedCloseDate = isOptionalDate(values.expectedCloseDate)
    ? values.expectedCloseDate
    : undefined;
  const estimatedAmount = isSafeNonNegativeAmount(values.estimatedAmount)
    ? values.estimatedAmount
    : undefined;
  const nextContactTime = isOptionalDateTime(values.nextContactTime)
    ? values.nextContactTime
    : undefined;
  const description = optionalText(values.description);
  const primaryContactId =
    values.primaryContactId !== undefined && uniqueContactIds?.includes(values.primaryContactId)
      ? values.primaryContactId
      : undefined;
  const customFields = Object.fromEntries(
    Object.entries(values.customFields ?? {}).flatMap(([code, fieldValues]) => {
      const normalized = [...new Set(fieldValues.map((value) => value.trim()).filter(Boolean))];
      return normalized.length === 0 ? [] : [[code, normalized]];
    }),
  );
  const fileFieldSubmission = values.fileFieldSubmission;
  const fileFields =
    fileFieldSubmission !== undefined &&
    Number.isSafeInteger(fileFieldSubmission.draftId) &&
    fileFieldSubmission.draftId > 0
      ? Object.fromEntries(
          Object.entries(fileFieldSubmission.fields).flatMap(([code, fileIds]) => {
            const normalized = [...new Set(fileIds)].filter(
              (fileId) => Number.isSafeInteger(fileId) && fileId > 0,
            );
            return normalized.length === 0 ? [] : [[code, normalized]];
          }),
        )
      : {};

  return {
    ...(uniqueContactIds === undefined || uniqueContactIds.length === 0
      ? {}
      : { contactIds: uniqueContactIds }),
    customerId: values.customerId,
    ...(description === undefined ? {} : { description }),
    ...(estimatedAmount === undefined ? {} : { estimatedAmount }),
    ...(expectedCloseDate === undefined ? {} : { expectedCloseDate }),
    name: values.name.trim(),
    ...(nextContactTime === undefined ? {} : { nextContactTime }),
    ...(values.ownerActorId === undefined ? {} : { ownerActorId: values.ownerActorId }),
    pipelineCode: values.pipelineCode,
    ...(primaryContactId === undefined ? {} : { primaryContactId }),
    stageCode: values.stageCode,
    ...(Object.keys(customFields).length === 0 ? {} : { customFields }),
    ...(Object.keys(fileFields).length === 0 || fileFieldSubmission === undefined
      ? {}
      : { fileFieldDraftId: fileFieldSubmission.draftId, fileFields }),
  };
}

/**
 * Opportunity PUT replaces its base fields. Values can only come from the
 * authoritative editable baseline and the user-facing form, never a detail or
 * list projection that may mask values.
 */
export function toOpportunityUpdateRequest(
  values: OpportunityUpdateValues,
  baseline: CompleteOpportunityEditableBaseline,
  relationships: OpportunityUpdateRelationshipValues = {},
): components["schemas"]["OpportunityUpdateRequest"] {
  const pipelineStage = selectedPipelineStage(relationships);
  return {
    customerId: isPositiveIdentifier(relationships.customerId)
      ? relationships.customerId
      : baseline.customerId,
    description: optionalText(values.description),
    estimatedAmount: isSafeNonNegativeAmount(values.estimatedAmount)
      ? values.estimatedAmount
      : undefined,
    expectedCloseDate: optionalText(values.expectedCloseDate),
    name: values.name.trim(),
    nextContactTime: optionalText(values.nextContactTime) ?? null,
    pipelineCode: pipelineStage?.pipelineCode ?? baseline.pipelineCode,
    stageCode: pipelineStage?.stageCode ?? baseline.stageCode,
    version: baseline.version,
  };
}

/**
 * Opportunity PUT replaces its base fields, so the base request must still be
 * constructed exclusively from the complete editable baseline. Dynamic field
 * codes merge on the server: this helper adds only codes explicitly touched
 * in a blank-starting form and retains empty arrays for intentional clears.
 * Detail values must never seed this write payload.
 */
export function toOpportunityCustomFieldUpdateRequest(
  values: OpportunityUpdateValues,
  baseline: CompleteOpportunityEditableBaseline,
  definitions: readonly FieldDefinition[],
  customFieldValues: OpportunityCustomFieldUpdateValues,
  relationships: OpportunityUpdateRelationshipValues = {},
): components["schemas"]["OpportunityUpdateRequest"] {
  const definitionsByCode = new Map(
    customFieldFormDefinitions(definitions).map((definition) => [definition.code, definition]),
  );
  const customFields = Object.fromEntries(
    [...customFieldValues.changedCodes].flatMap((code) => {
      const definition = definitionsByCode.get(code);
      if (definition === undefined) return [];
      const normalized =
        toCustomFieldFormValues([definition], {
          [code]: customFieldValues.customFields[code] ?? [],
        })[code] ?? [];
      return [[code, normalized]];
    }),
  );

  return {
    ...toOpportunityUpdateRequest(values, baseline, relationships),
    ...(Object.keys(customFields).length === 0
      ? {}
      : {
          customFields: Object.fromEntries(
            Object.entries(customFields).map(([code, fieldValues]) => [code, [...fieldValues]]),
          ),
        }),
  };
}

export function hasOpportunityUpdateChanges(
  values: OpportunityUpdateValues,
  baseline: CompleteOpportunityEditableBaseline,
  relationships: OpportunityUpdateRelationshipValues = {},
): boolean {
  const initial = opportunityUpdateValuesFromBaseline(baseline);
  const pipelineStage = selectedPipelineStage(relationships);
  return (
    values.name.trim() !== initial.name ||
    optionalText(values.expectedCloseDate) !== initial.expectedCloseDate ||
    values.estimatedAmount !== initial.estimatedAmount ||
    values.nextContactTime !== initial.nextContactTime ||
    optionalText(values.description) !== initial.description ||
    (isPositiveIdentifier(relationships.customerId) &&
      relationships.customerId !== baseline.customerId) ||
    (pipelineStage !== null &&
      (pipelineStage.pipelineCode !== baseline.pipelineCode ||
        pipelineStage.stageCode !== baseline.stageCode))
  );
}
