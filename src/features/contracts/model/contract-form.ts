import type { components } from "~/api/generated/schema";
import {
  toCustomFieldFormValues,
  type CustomFieldValues,
  type FieldDefinition,
} from "~/components/dynamic-field";

export interface ContractCreateValues {
  contactId?: number;
  customerId: number;
  contractType?: string;
  customFields?: CustomFieldValues;
  discountRate?: number;
  endDate?: string;
  name: string;
  number: string;
  orderDate?: string;
  opportunityId?: number;
  ownerActorId?: number;
  paymentType?: string;
  fileFieldSubmission?: ContractFileFieldSubmission;
  products: readonly ContractProductCreateValues[];
  remark?: string;
  startDate?: string;
}

/** File IDs can only originate from an unexpired server-issued CONTRACT draft. */
export interface ContractFileFieldSubmission {
  draftId: number;
  fields: Readonly<Record<string, readonly number[]>>;
}

export interface ContractProductCreateValues {
  productId: number;
  quantity: number;
  unitPrice?: number;
}

export interface ContractBasicUpdateValues {
  name: string;
  number: string;
  originalName: string;
  originalNumber: string;
  version: number;
}

export interface ContractCustomFieldUpdateValues {
  changedCodes: ReadonlySet<string>;
  customFields: CustomFieldValues;
  version: number;
}

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

/**
 * Sends user-entered contract values without calculating line or total amounts.
 * The server owns price defaults, discounts, and every persisted amount.
 * Dynamic values are catalog-backed; file IDs additionally require one
 * server-issued CONTRACT draft.
 */
export function toContractCreateRequest(
  values: ContractCreateValues,
): components["schemas"]["ContractCreateRequest"] {
  const contractType = optionalText(values.contractType);
  const paymentType = optionalText(values.paymentType);
  const remark = optionalText(values.remark);
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
    ...(contractType === undefined ? {} : { contractType }),
    ...(values.contactId === undefined ? {} : { contactId: values.contactId }),
    customerId: values.customerId,
    ...(values.discountRate === undefined ? {} : { discountRate: values.discountRate }),
    ...(values.endDate === undefined ? {} : { endDate: values.endDate }),
    ...(Object.keys(customFields).length === 0 ? {} : { customFields }),
    ...(Object.keys(fileFields).length === 0 || fileFieldSubmission === undefined
      ? {}
      : { fileFieldDraftId: fileFieldSubmission.draftId, fileFields }),
    name: values.name.trim(),
    number: values.number.trim(),
    ...(values.orderDate === undefined ? {} : { orderDate: values.orderDate }),
    ...(values.opportunityId === undefined ? {} : { opportunityId: values.opportunityId }),
    ...(values.ownerActorId === undefined ? {} : { ownerActorId: values.ownerActorId }),
    ...(paymentType === undefined ? {} : { paymentType }),
    products: values.products.map((product) => ({
      productId: product.productId,
      quantity: product.quantity,
      ...(product.unitPrice === undefined ? {} : { unitPrice: product.unitPrice }),
    })),
    ...(remark === undefined ? {} : { remark }),
    ...(values.startDate === undefined ? {} : { startDate: values.startDate }),
  };
}

/**
 * Keep contract updates deliberately narrow. Relations, products, discounts,
 * amounts, files, and dynamic fields are not a safe browser update baseline.
 */
export function toContractBasicUpdateRequest(
  values: ContractBasicUpdateValues,
): components["schemas"]["ContractUpdateRequest"] {
  const name = values.name.trim();
  const number = values.number.trim();
  return {
    ...(name === values.originalName ? {} : { name }),
    ...(number === values.originalNumber ? {} : { number }),
    version: values.version,
  };
}

/**
 * Contract PATCH merges the submitted catalog codes into server state. Detail
 * values never initialize this form, so only explicit user changes cross the
 * write boundary and an empty array intentionally clears that one code.
 */
export function toContractCustomFieldUpdateRequest(
  definitions: readonly FieldDefinition[],
  values: ContractCustomFieldUpdateValues,
): components["schemas"]["ContractUpdateRequest"] {
  const definitionsByCode = new Map(definitions.map((definition) => [definition.code, definition]));
  const customFields = Object.fromEntries(
    [...values.changedCodes].flatMap((code) => {
      const definition = definitionsByCode.get(code);
      if (definition === undefined) return [];
      const normalized =
        toCustomFieldFormValues([definition], {
          [code]: values.customFields[code] ?? [],
        })[code] ?? [];
      return [[code, normalized]];
    }),
  );

  return {
    customFields: Object.fromEntries(
      Object.entries(customFields).map(([code, fieldValues]) => [code, [...fieldValues]]),
    ),
    version: values.version,
  };
}
