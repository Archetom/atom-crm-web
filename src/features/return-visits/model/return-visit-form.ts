import type { components } from "~/api/generated/schema";
import {
  toCustomFieldFormValues,
  type CustomFieldValues,
  type FieldDefinition,
} from "~/components/dynamic-field";

import type { ReturnVisitForm, ReturnVisitSatisfaction } from "./return-visit-fields";

export interface ReturnVisitCreateValues {
  customerId: number;
  contactId?: number;
  contractId?: number;
  customFields?: CustomFieldValues;
  fileFieldSubmission?: ReturnVisitFileFieldSubmission;
  ownerActorId?: number;
  visitTime: string;
  visitForm?: ReturnVisitForm;
  satisfaction?: ReturnVisitSatisfaction;
  remark?: string;
}

/** File IDs can only originate from an unexpired server-issued RETURN_VISIT draft. */
export interface ReturnVisitFileFieldSubmission {
  draftId: number;
  fields: Readonly<Record<string, readonly number[]>>;
}

export interface ReturnVisitUpdateValues {
  baselineRemark: string;
  remark: string;
  version: number;
  visitTime: string;
  baselineVisitForm?: ReturnVisitForm | null;
  visitForm?: ReturnVisitForm | null;
  baselineSatisfaction?: ReturnVisitSatisfaction | null;
  satisfaction?: ReturnVisitSatisfaction | null;
}

export interface ReturnVisitRelationUpdateValues extends ReturnVisitUpdateValues {
  relation: "contact" | "contract";
  relationId: number | null;
}

export interface ReturnVisitCustomFieldUpdateValues {
  baselineRemark: string;
  changedCodes: ReadonlySet<string>;
  customFields: CustomFieldValues;
  version: number;
  visitTime: string;
}

/** Sends only current-customer fields and a user-confirmed directory owner. */
export function toReturnVisitCreateRequest(
  values: ReturnVisitCreateValues,
): components["schemas"]["ReturnVisitCreateRequest"] {
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
    customerId: values.customerId,
    ...(values.contactId === undefined ? {} : { contactId: values.contactId }),
    ...(values.contractId === undefined ? {} : { contractId: values.contractId }),
    ...(Object.keys(customFields).length === 0 ? {} : { customFields }),
    ...(Object.keys(fileFields).length === 0 || fileFieldSubmission === undefined
      ? {}
      : { fileFieldDraftId: fileFieldSubmission.draftId, fileFields }),
    ...(values.ownerActorId === undefined ? {} : { ownerActorId: values.ownerActorId }),
    visitTime: values.visitTime,
    ...(values.visitForm === undefined ? {} : { visitForm: values.visitForm }),
    ...(values.satisfaction === undefined ? {} : { satisfaction: values.satisfaction }),
    ...(remark ? { remark } : {}),
  };
}

/**
 * B15 makes omitted contact and contract fields retain their server values.
 * This form intentionally sends neither relation nor dynamic/file fields.
 */
export function toReturnVisitUpdateRequest(
  values: ReturnVisitUpdateValues,
): components["schemas"]["ReturnVisitUpdateRequest"] {
  const remark =
    values.remark === values.baselineRemark ? values.baselineRemark : values.remark.trim();
  return {
    version: values.version,
    visitTime: values.visitTime,
    ...(values.visitForm === undefined || values.baselineVisitForm === values.visitForm
      ? {}
      : { visitForm: values.visitForm }),
    ...(values.satisfaction === undefined || values.baselineSatisfaction === values.satisfaction
      ? {}
      : { satisfaction: values.satisfaction }),
    remark,
  };
}

/**
 * B15 preserves an omitted relation and clears only an explicitly null one,
 * so this update touches exactly one selected or cleared relation while
 * retaining the complete visible time/remark baseline.
 */
export function toReturnVisitRelationUpdateRequest(
  values: ReturnVisitRelationUpdateValues,
): components["schemas"]["ReturnVisitUpdateRequest"] {
  const request = toReturnVisitUpdateRequest(values);
  return values.relation === "contact"
    ? { ...request, contactId: values.relationId }
    : { ...request, contractId: values.relationId };
}

/**
 * Return-visit updates require an unmasked visit-time and remark baseline.
 * Custom-field values still start blank: only explicit catalog-backed codes
 * cross the write boundary, while omitted codes remain on the server.
 */
export function toReturnVisitCustomFieldUpdateRequest(
  definitions: readonly FieldDefinition[],
  values: ReturnVisitCustomFieldUpdateValues,
): components["schemas"]["ReturnVisitUpdateRequest"] {
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
    remark: values.baselineRemark,
    version: values.version,
    visitTime: values.visitTime,
  };
}
