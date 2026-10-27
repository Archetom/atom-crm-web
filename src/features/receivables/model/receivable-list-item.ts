import { decodeCustomFieldValues, type CustomFieldValues } from "~/components/dynamic-field";
import {
  decodeControlledFileFields,
  type ControlledFileField,
} from "~/components/controlled-file-field/model";
import {
  toApprovalInstanceStatus,
  type ApprovalInstanceStatus,
} from "~/features/approvals/model/approval-status";
import { recordOf } from "~/shared/utils/decode";

export interface ReceivableListItem {
  amount: number | null;
  approvalStatus: ApprovalInstanceStatus | null;
  customFields?: CustomFieldValues;
  fileFields: readonly ControlledFileField[];
  id: number;
  ownerActorId: number | null;
  paymentMethod: string | null;
  remark: string | null;
  version: number;
  customerId: number;
  contractId: number | null;
  receivablePlanId: number | null;
  receiptNumber: string | null;
  receivedDate: string | null;
  status: string | null;
  createdTime: string | null;
  updatedTime: string | null;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalIdentifier(value: unknown): number | null {
  return value === null || value === undefined ? null : positiveIdentifier(value);
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Keep only server-authorized scalar values. The backend already omits hidden fields and masks
 * where applicable; this projection never reconstructs a suppressed value from other response data.
 */
export function toReceivableListItem(value: unknown): ReceivableListItem | null {
  const source = recordOf(value);
  if (source === null) return null;
  const id = positiveIdentifier(source.id);
  const customerId = positiveIdentifier(source.customerId);
  const contractId = optionalIdentifier(source.contractId);
  const receivablePlanId = optionalIdentifier(source.receivablePlanId);
  const version = source.version;
  if (
    id === null ||
    customerId === null ||
    (source.contractId !== null && source.contractId !== undefined && contractId === null) ||
    (source.receivablePlanId !== null &&
      source.receivablePlanId !== undefined &&
      receivablePlanId === null) ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    return null;
  }
  return {
    amount: optionalNumber(source.amount),
    approvalStatus: toApprovalInstanceStatus(source.approvalStatus),
    ...(source.customFields === undefined
      ? {}
      : { customFields: decodeCustomFieldValues(source.customFields) }),
    fileFields: decodeControlledFileFields(source.fileFields),
    id,
    ownerActorId: optionalIdentifier(source.ownerActorId),
    paymentMethod: optionalText(source.paymentMethod),
    remark: optionalText(source.remark),
    version,
    customerId,
    contractId,
    receivablePlanId,
    receiptNumber: optionalText(source.receiptNumber),
    receivedDate: optionalText(source.receivedDate),
    status: optionalText(source.status),
    createdTime: optionalText(source.createdTime),
    updatedTime: optionalText(source.updatedTime),
  };
}
