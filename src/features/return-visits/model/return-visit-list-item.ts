import { decodeCustomFieldValues, type CustomFieldValues } from "~/components/dynamic-field";
import {
  toApprovalInstanceStatus,
  type ApprovalInstanceStatus,
} from "~/features/approvals/model/approval-status";

import {
  toReturnVisitForm,
  toReturnVisitSatisfaction,
  type ReturnVisitForm,
  type ReturnVisitSatisfaction,
} from "./return-visit-fields";
import { nullableString, recordOf } from "~/shared/utils/decode";

export interface ReturnVisitListItem {
  approvalStatus: ApprovalInstanceStatus | null;
  customFields?: CustomFieldValues;
  id: number;
  version: number;
  ownerActorId: number | null;
  customerId: number | null;
  contactId: number | null;
  contactRelationState: ReturnVisitRelationState;
  contractId: number | null;
  contractRelationState: ReturnVisitRelationState;
  visitNumber: string | null;
  visitTime: string | null;
  visitForm: ReturnVisitForm | null;
  satisfaction: ReturnVisitSatisfaction | null;
  remark: string | null;
  status: string | null;
  createdTime: string | null;
  updatedTime: string | null;
}

export type ReturnVisitRelationState = "VISIBLE" | "HIDDEN" | "EMPTY";

function optionalPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function relationState(value: unknown, relationId: number | null): ReturnVisitRelationState {
  if (value === "VISIBLE" && relationId !== null) return "VISIBLE";
  if (value === "EMPTY" && relationId === null) return "EMPTY";
  return "HIDDEN";
}

/**
 * Keep the list projection narrow and tolerate server-authorized hidden or masked business fields.
 */
export function toReturnVisitListItem(value: unknown): ReturnVisitListItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = optionalPositiveNumber(source.id);
  const version = source.version;
  if (id === null || typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) {
    return null;
  }

  const contactId = optionalPositiveNumber(source.contactId);
  const contractId = optionalPositiveNumber(source.contractId);

  return {
    approvalStatus: toApprovalInstanceStatus(source.approvalStatus),
    ...(source.customFields === undefined
      ? {}
      : { customFields: decodeCustomFieldValues(source.customFields) }),
    id,
    version,
    ownerActorId: optionalPositiveNumber(source.ownerActorId),
    customerId: optionalPositiveNumber(source.customerId),
    contactId,
    contactRelationState: relationState(source.contactRelationState, contactId),
    contractId,
    contractRelationState: relationState(source.contractRelationState, contractId),
    visitNumber: nullableString(source.visitNumber),
    visitTime: nullableString(source.visitTime),
    visitForm: toReturnVisitForm(source.visitForm),
    satisfaction: toReturnVisitSatisfaction(source.satisfaction),
    remark: nullableString(source.remark),
    status: nullableString(source.status),
    createdTime: nullableString(source.createdTime),
    updatedTime: nullableString(source.updatedTime),
  };
}
