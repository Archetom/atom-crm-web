import { decodeCustomFieldValues, type CustomFieldValues } from "~/components/dynamic-field";
import { optionalString, recordOf } from "~/shared/utils/decode";

export interface OpportunityListItem {
  customFields?: CustomFieldValues;
  description: string | null;
  estimatedAmount: number | null;
  expectedCloseDate: string | null;
  id: number;
  lastActivityTime: string | null;
  name: string;
  customerId: number | null;
  nextContactTime: string | null;
  ownerActorId: number | null;
  pipelineCode: string | null;
  stageCode: string | null;
  outcome: string | null;
  status: string | null;
  starred: boolean;
  version?: number;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function optionalLocalDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function optionalLocalDateTime(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/.test(value)
  ) {
    return null;
  }
  return value;
}

/** Narrow, fail-closed list projection of the generated Opportunity response contract. */
export function toOpportunityListItem(value: unknown): OpportunityListItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const name = optionalString(source.name);
  if (id === null || name === null) return null;

  return {
    id,
    ...(source.customFields === undefined
      ? {}
      : { customFields: decodeCustomFieldValues(source.customFields) }),
    description: optionalString(source.description),
    estimatedAmount: optionalAmount(source.estimatedAmount),
    expectedCloseDate: optionalLocalDate(source.expectedCloseDate),
    lastActivityTime: optionalLocalDateTime(source.lastActivityTime),
    name,
    customerId: positiveIdentifier(source.customerId),
    nextContactTime: optionalLocalDateTime(source.nextContactTime),
    ownerActorId: positiveIdentifier(source.ownerActorId),
    pipelineCode: optionalString(source.pipelineCode),
    stageCode: optionalString(source.stageCode),
    outcome: optionalString(source.outcome),
    status: optionalString(source.status),
    starred: source.starred === true,
    ...(typeof source.version === "number" &&
    Number.isSafeInteger(source.version) &&
    source.version >= 0
      ? { version: source.version }
      : {}),
  };
}
