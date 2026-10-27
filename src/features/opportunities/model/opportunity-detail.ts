import {
  decodeControlledFileFields,
  type ControlledFileField,
} from "~/components/controlled-file-field/model";
import { decodeCustomFieldValues, type CustomFieldValues } from "~/components/dynamic-field";
import { optionalString, recordOf } from "~/shared/utils/decode";

export interface OpportunityDetail {
  id: number;
  version: number;
  name: string;
  ownerActorId: number | null;
  customerId: number | null;
  pipelineCode: string | null;
  stageCode: string | null;
  expectedCloseDate: string | null;
  estimatedAmount: number | null;
  nextContactTime: string | null;
  description: string | null;
  outcome: string | null;
  outcomeTime: string | null;
  outcomeRemark: string | null;
  status: string | null;
  starred: boolean;
  customFields?: CustomFieldValues;
  fileFields: readonly ControlledFileField[];
  createdTime: string | null;
  updatedTime: string | null;
}

function optionalIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * Narrow, fail-closed detail projection. Amounts, contacts, products,
 * collaborators, and custom fields remain display-only; FILE fields retain
 * only server-authorized paths for controlled downloads.
 */
export function toOpportunityDetail(value: unknown): OpportunityDetail | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = optionalIdentifier(source.id);
  const name = optionalString(source.name);
  const version =
    typeof source.version === "number" &&
    Number.isSafeInteger(source.version) &&
    source.version >= 0
      ? source.version
      : null;
  if (id === null || name === null || version === null) return null;

  return {
    id,
    version,
    name,
    ownerActorId: optionalIdentifier(source.ownerActorId),
    customerId: optionalIdentifier(source.customerId),
    pipelineCode: optionalString(source.pipelineCode),
    stageCode: optionalString(source.stageCode),
    expectedCloseDate: optionalString(source.expectedCloseDate),
    estimatedAmount:
      typeof source.estimatedAmount === "number" &&
      Number.isFinite(source.estimatedAmount) &&
      source.estimatedAmount >= 0
        ? source.estimatedAmount
        : null,
    nextContactTime: optionalString(source.nextContactTime),
    description: optionalString(source.description),
    outcome: optionalString(source.outcome),
    outcomeTime: optionalString(source.outcomeTime),
    outcomeRemark: optionalString(source.outcomeRemark),
    status: optionalString(source.status),
    starred: source.starred === true,
    ...(source.customFields === undefined
      ? {}
      : { customFields: decodeCustomFieldValues(source.customFields) }),
    fileFields: decodeControlledFileFields(source.fileFields),
    createdTime: optionalString(source.createdTime),
    updatedTime: optionalString(source.updatedTime),
  };
}
