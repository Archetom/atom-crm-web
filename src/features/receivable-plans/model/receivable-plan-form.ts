import type { components } from "~/api/generated/schema";
import {
  toCustomFieldFormValues,
  type CustomFieldValues,
  type FieldDefinition,
} from "~/components/dynamic-field";

export const maximumReceivablePlanReminderDays = 2_147_483_647;

export interface ReceivablePlanCreateValues {
  contractId: number;
  customFields?: CustomFieldValues;
  dueDate: string;
  fileFieldSubmission?: ReceivablePlanFileFieldSubmission;
  paymentMethod: string;
  plannedAmount: number;
  reminderDays?: number;
  remark?: string;
}

/** File IDs can only originate from an unexpired server-issued RECEIVABLE_PLAN draft. */
export interface ReceivablePlanFileFieldSubmission {
  draftId: number;
  fields: Readonly<Record<string, readonly number[]>>;
}

export interface ReceivablePlanBatchDraftValues {
  customFields?: CustomFieldValues;
  dueDate: string;
  paymentMethod: string;
  plannedAmount: number;
  reminderDays?: number;
  remark?: string;
}

export interface ReceivablePlanDueDateUpdateValues {
  dueDate: string;
  originalDueDate: string;
  version: number;
}

function normalizeCustomFields(values: CustomFieldValues | undefined): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(values ?? {}).flatMap(([code, fieldValues]) => {
      const normalized = [...new Set(fieldValues.map((value) => value.trim()).filter(Boolean))];
      return normalized.length === 0 ? [] : [[code, normalized]];
    }),
  );
}

/**
 * Reminder days and an optional remark can only originate from the current
 * form. Dynamic values are catalog-backed, and file IDs additionally require
 * one server-issued RECEIVABLE_PLAN draft.
 */
export function toReceivablePlanCreateRequest(
  values: ReceivablePlanCreateValues,
): components["schemas"]["ReceivablePlanCreateRequest"] {
  const remark = values.remark?.trim();
  const customFields = normalizeCustomFields(values.customFields);
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
    contractId: values.contractId,
    ...(Object.keys(customFields).length === 0 ? {} : { customFields }),
    dueDate: values.dueDate,
    ...(Object.keys(fileFields).length === 0 || fileFieldSubmission === undefined
      ? {}
      : { fileFieldDraftId: fileFieldSubmission.draftId, fileFields }),
    paymentMethod: values.paymentMethod.trim(),
    plannedAmount: values.plannedAmount,
    ...(values.reminderDays === undefined ? {} : { reminderDays: values.reminderDays }),
    ...(remark === undefined || remark === "" ? {} : { remark }),
  };
}

/**
 * Batch rows are authored independently. Scalar dynamic values, optional
 * reminder, and optional remark can only cross the request boundary for their
 * corresponding row. The generated batch contract has no file-draft binding.
 */
export function toReceivablePlanBatchCreateRequest(
  contractId: number,
  plans: readonly ReceivablePlanBatchDraftValues[],
): components["schemas"]["ReceivablePlanBatchCreateRequest"] {
  return {
    contractId,
    plans: plans.map((plan) => {
      const remark = plan.remark?.trim();
      const customFields = normalizeCustomFields(plan.customFields);

      return {
        ...(Object.keys(customFields).length === 0 ? {} : { customFields }),
        dueDate: plan.dueDate,
        paymentMethod: plan.paymentMethod.trim(),
        plannedAmount: plan.plannedAmount,
        ...(plan.reminderDays === undefined ? {} : { reminderDays: plan.reminderDays }),
        ...(remark === undefined || remark === "" ? {} : { remark }),
      };
    }),
  };
}

/**
 * The basic detail editor has no safe baseline for money or payment fields, so
 * it only updates a changed server-returned due date. Catalog-backed custom
 * fields use their separate explicit merge helper below.
 */
export function toReceivablePlanDueDateUpdateRequest(
  values: ReceivablePlanDueDateUpdateValues,
): components["schemas"]["ReceivablePlanUpdateRequest"] {
  const dueDate = values.dueDate.trim();
  return {
    ...(dueDate === values.originalDueDate ? {} : { dueDate }),
    version: values.version,
  };
}

/**
 * Leaves masked detail values outside the write path. Empty lists clear only
 * explicitly touched catalog fields; omitted codes retain server values.
 */
export function toReceivablePlanCustomFieldUpdateValues(
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

export function toReceivablePlanCustomFieldUpdateRequest(
  definitions: readonly FieldDefinition[],
  values: CustomFieldValues,
  changedCodes: ReadonlySet<string>,
  version: number,
): components["schemas"]["ReceivablePlanUpdateRequest"] {
  return {
    customFields: Object.fromEntries(
      Object.entries(
        toReceivablePlanCustomFieldUpdateValues(definitions, values, changedCodes),
      ).map(([code, fieldValues]) => [code, [...fieldValues]]),
    ),
    version,
  };
}
