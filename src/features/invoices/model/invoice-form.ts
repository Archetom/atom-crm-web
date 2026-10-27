import type { components } from "~/api/generated/schema";
import {
  toCustomFieldFormValues,
  type CustomFieldValues,
  type FieldDefinition,
} from "~/components/dynamic-field";

export const invoiceTitleTypeOptions = [
  { label: "个人", value: "INDIVIDUAL" },
  { label: "单位", value: "ORGANIZATION" },
] as const;

export type InvoiceTitleType = (typeof invoiceTitleTypeOptions)[number]["value"];

export interface InvoiceCreateValues {
  amount: number;
  bankAccount?: string;
  bankName?: string;
  contactName?: string;
  contactPhone?: string;
  contractId: number;
  customFields?: CustomFieldValues;
  fileFieldSubmission?: InvoiceFileFieldSubmission;
  invoiceType: string;
  ownerActorId?: number;
  registeredAddress?: string;
  registeredPhone?: string;
  remark?: string;
  requestedDate?: string;
  shippingAddress?: string;
  taxNumber?: string;
  title: string;
  titleType: InvoiceTitleType;
}

/** File IDs can only originate from an unexpired server-issued INVOICE draft. */
export interface InvoiceFileFieldSubmission {
  draftId: number;
  fields: Readonly<Record<string, readonly number[]>>;
}

export interface InvoiceBasicUpdateValues {
  invoiceType: string;
  originalInvoiceType: string;
  originalRequestedDate: string;
  requestedDate: string;
  version: number;
}

export function isInvoiceTitleType(value: unknown): value is InvoiceTitleType {
  return value === "INDIVIDUAL" || value === "ORGANIZATION";
}

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

/**
 * Creates an invoice application only from values explicitly entered in the
 * current form. Unit-title tax and registration fields are never sent for an
 * individual title. Dynamic values are catalog-backed, and file IDs also
 * require one server-issued INVOICE draft. An owner is sent only when
 * explicitly selected from the server member directory.
 */
export function toInvoiceCreateRequest(
  values: InvoiceCreateValues,
): components["schemas"]["InvoiceCreateRequest"] {
  const bankAccount = optionalText(values.bankAccount);
  const bankName = optionalText(values.bankName);
  const contactName = optionalText(values.contactName);
  const contactPhone = optionalText(values.contactPhone);
  const registeredAddress = optionalText(values.registeredAddress);
  const registeredPhone = optionalText(values.registeredPhone);
  const remark = optionalText(values.remark);
  const shippingAddress = optionalText(values.shippingAddress);
  const taxNumber = optionalText(values.taxNumber);
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
    amount: values.amount,
    contractId: values.contractId,
    ...(Object.keys(customFields).length === 0 ? {} : { customFields }),
    ...(Object.keys(fileFields).length === 0 || fileFieldSubmission === undefined
      ? {}
      : { fileFieldDraftId: fileFieldSubmission.draftId, fileFields }),
    invoiceType: values.invoiceType.trim(),
    ...(values.ownerActorId === undefined ? {} : { ownerActorId: values.ownerActorId }),
    title: values.title.trim(),
    titleType: values.titleType,
    ...(values.requestedDate === undefined ? {} : { requestedDate: values.requestedDate }),
    ...(contactName === undefined ? {} : { contactName }),
    ...(contactPhone === undefined ? {} : { contactPhone }),
    ...(shippingAddress === undefined ? {} : { shippingAddress }),
    ...(remark === undefined ? {} : { remark }),
    ...(values.titleType === "ORGANIZATION"
      ? {
          ...(taxNumber === undefined ? {} : { taxNumber }),
          ...(bankName === undefined ? {} : { bankName }),
          ...(bankAccount === undefined ? {} : { bankAccount }),
          ...(registeredAddress === undefined ? {} : { registeredAddress }),
          ...(registeredPhone === undefined ? {} : { registeredPhone }),
        }
      : {}),
  };
}

/**
 * The detail projection exposes only the application date and invoice type as
 * safe editable baseline fields. Every other invoice detail remains excluded.
 */
export function toInvoiceBasicUpdateRequest(
  values: InvoiceBasicUpdateValues,
): components["schemas"]["InvoiceUpdateRequest"] {
  const invoiceType = values.invoiceType.trim();
  const requestedDate = values.requestedDate.trim();
  return {
    ...(invoiceType === values.originalInvoiceType ? {} : { invoiceType }),
    ...(requestedDate === values.originalRequestedDate ? {} : { requestedDate }),
    version: values.version,
  };
}

/**
 * Keeps explicit catalog-backed changes separate from a possibly masked invoice
 * detail projection. An empty value list deliberately clears only a field the
 * user touched; omitted codes retain their server value.
 */
export function toInvoiceCustomFieldUpdateValues(
  definitions: readonly FieldDefinition[],
  values: CustomFieldValues,
  changedCodes: ReadonlySet<string>,
): CustomFieldValues {
  const definitionsByCode = new Map(definitions.map((definition) => [definition.code, definition]));
  return Object.fromEntries(
    [...changedCodes].flatMap((code) => {
      const definition = definitionsByCode.get(code);
      if (definition === undefined) return [];
      const normalized =
        toCustomFieldFormValues([definition], {
          [code]: values[code] ?? [],
        })[code] ?? [];
      return [[code, normalized]];
    }),
  );
}

export function toInvoiceCustomFieldUpdateRequest(
  definitions: readonly FieldDefinition[],
  values: CustomFieldValues,
  changedCodes: ReadonlySet<string>,
  version: number,
): components["schemas"]["InvoiceUpdateRequest"] {
  return {
    customFields: Object.fromEntries(
      Object.entries(toInvoiceCustomFieldUpdateValues(definitions, values, changedCodes)).map(
        ([code, fieldValues]) => [code, [...fieldValues]],
      ),
    ),
    version,
  };
}
