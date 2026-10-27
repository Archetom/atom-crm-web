import {
  decodeControlledFileFields,
  type ControlledFileField,
} from "~/components/controlled-file-field/model";
import { decodeCustomFieldValues, type CustomFieldValues } from "~/components/dynamic-field";
import { recordOf } from "~/shared/utils/decode";

export interface ReceivablePlanListItem {
  customFields?: CustomFieldValues;
  fileFields: readonly ControlledFileField[];
  id: number;
  version: number;
  customerId: number | null;
  contractId: number | null;
  installment: number | null;
  dueDate: string | null;
  plannedAmount: number | null;
  receivedAmount: number | null;
  remainingAmount: number | null;
  paymentMethod: string | null;
  reminderDays: number | null;
  remark: string | null;
  ownerActorId: number | null;
  progress: string | null;
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

function optionalNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function optionalAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Keeps only server-authorized list fields plus separately bounded custom and FILE projections.
 * Money is never recomputed: nullable values are formatted only when the server supplies them.
 */
export function toReceivablePlanListItem(value: unknown): ReceivablePlanListItem | null {
  const source = recordOf(value);
  if (source === null) return null;
  const id = positiveIdentifier(source.id);
  const customerId = optionalIdentifier(source.customerId);
  const contractId = optionalIdentifier(source.contractId);
  const installment = optionalIdentifier(source.installment);
  const version = source.version;
  if (
    id === null ||
    (source.customerId !== null && source.customerId !== undefined && customerId === null) ||
    (source.contractId !== null && source.contractId !== undefined && contractId === null) ||
    (source.installment !== null && source.installment !== undefined && installment === null) ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    return null;
  }
  return {
    ...(source.customFields === undefined
      ? {}
      : { customFields: decodeCustomFieldValues(source.customFields) }),
    fileFields: decodeControlledFileFields(source.fileFields),
    id,
    version,
    customerId,
    contractId,
    installment,
    dueDate: optionalText(source.dueDate),
    plannedAmount: optionalAmount(source.plannedAmount),
    receivedAmount: optionalAmount(source.receivedAmount),
    remainingAmount: optionalAmount(source.remainingAmount),
    paymentMethod: optionalText(source.paymentMethod),
    reminderDays: optionalNonNegativeInteger(source.reminderDays),
    remark: optionalText(source.remark),
    ownerActorId: optionalIdentifier(source.ownerActorId),
    progress: optionalText(source.progress),
    status: optionalText(source.status),
    createdTime: optionalText(source.createdTime),
    updatedTime: optionalText(source.updatedTime),
  };
}
