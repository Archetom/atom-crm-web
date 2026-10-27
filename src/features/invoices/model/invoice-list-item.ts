import { decodeCustomFieldValues, type CustomFieldValues } from "~/components/dynamic-field";
import {
  decodeControlledFileFields,
  type ControlledFileField,
} from "~/components/controlled-file-field/model";
import { recordOf } from "~/shared/utils/decode";

export interface InvoiceListItem {
  customFields?: CustomFieldValues;
  fileFields: readonly ControlledFileField[];
  id: number;
  version: number;
  customerId: number;
  contractId: number | null;
  applicationNumber: string | null;
  invoiceNumber: string | null;
  invoiceType: string | null;
  issuedDate: string | null;
  requestedDate: string | null;
  status: string | null;
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

/** Keeps only server-authorized values and never reconstructs hidden field data. */
export function toInvoiceListItem(value: unknown): InvoiceListItem | null {
  const source = recordOf(value);
  if (source === null) return null;
  const id = positiveIdentifier(source.id);
  const customerId = positiveIdentifier(source.customerId);
  const contractId = optionalIdentifier(source.contractId);
  const version = source.version;
  if (
    id === null ||
    customerId === null ||
    (source.contractId !== null && source.contractId !== undefined && contractId === null) ||
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
    applicationNumber: optionalText(source.applicationNumber),
    invoiceNumber: optionalText(source.invoiceNumber),
    invoiceType: optionalText(source.invoiceType),
    issuedDate: optionalText(source.issuedDate),
    requestedDate: optionalText(source.requestedDate),
    status: optionalText(source.status),
  };
}
