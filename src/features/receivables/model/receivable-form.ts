import type { components } from "~/api/generated/schema";
import {
  toCustomFieldFormValues,
  type CustomFieldValues,
  type FieldDefinition,
} from "~/components/dynamic-field";

export interface ReceivableCreateValues {
  amount: number;
  contractId: number;
  customFields?: CustomFieldValues;
  fileFieldSubmission?: ReceivableFileFieldSubmission;
  ownerActorId?: number;
  paymentMethod: string;
  receivablePlanId?: number;
  receivedDate: string;
  remark?: string;
}

/** File IDs can only originate from an unexpired server-issued RECEIVABLE draft. */
export interface ReceivableFileFieldSubmission {
  draftId: number;
  fields: Readonly<Record<string, readonly number[]>>;
}

export interface ReceivableReceivedDateUpdateValues {
  originalReceivedDate: string;
  receivedDate: string;
  version: number;
}

/**
 * A plan association is optional and can only originate from the selected
 * contract's server-visible available-plan directory. The optional remark is
 * sent only after an explicit current-form entry. Dynamic values are
 * catalog-backed, and file IDs additionally require one server-issued
 * RECEIVABLE draft.
 */
export function toReceivableCreateRequest(
  values: ReceivableCreateValues,
): components["schemas"]["ReceivableCreateRequest"] {
  const remark = values.remark?.trim();
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
    ...(values.ownerActorId === undefined ? {} : { ownerActorId: values.ownerActorId }),
    paymentMethod: values.paymentMethod.trim(),
    ...(values.receivablePlanId === undefined ? {} : { receivablePlanId: values.receivablePlanId }),
    receivedDate: values.receivedDate,
    ...(remark === undefined || remark === "" ? {} : { remark }),
  };
}

/**
 * The basic customer-context editor has no safe update baseline for money,
 * payment, plan association, or operational data, so it only updates the
 * received date. Catalog-backed custom fields use their separate explicit
 * merge helper below.
 */
export function toReceivableReceivedDateUpdateRequest(
  values: ReceivableReceivedDateUpdateValues,
): components["schemas"]["ReceivableUpdateRequest"] {
  const receivedDate = values.receivedDate.trim();
  return {
    ...(receivedDate === values.originalReceivedDate ? {} : { receivedDate }),
    version: values.version,
  };
}

/**
 * Leaves masked detail values outside the write path. Empty lists clear only
 * explicitly touched catalog fields; omitted codes retain server values.
 */
export function toReceivableCustomFieldUpdateValues(
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

export function toReceivableCustomFieldUpdateRequest(
  definitions: readonly FieldDefinition[],
  values: CustomFieldValues,
  changedCodes: ReadonlySet<string>,
  version: number,
): components["schemas"]["ReceivableUpdateRequest"] {
  return {
    customFields: Object.fromEntries(
      Object.entries(toReceivableCustomFieldUpdateValues(definitions, values, changedCodes)).map(
        ([code, fieldValues]) => [code, [...fieldValues]],
      ),
    ),
    version,
  };
}
