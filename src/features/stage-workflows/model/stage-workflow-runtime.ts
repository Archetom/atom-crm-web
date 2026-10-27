import {
  customFieldTypes,
  type CustomFieldType,
} from "~/components/dynamic-field/model/field-definition";
import { isoDateTime, nonBlankString, positiveInteger, recordOf } from "~/shared/utils/decode";

export const stageWorkflowRecordStatuses = [
  "ACTIVE",
  "AWAITING_APPROVAL",
  "SUCCEEDED",
  "FAILED",
] as const;

export type StageWorkflowRecordStatus = (typeof stageWorkflowRecordStatuses)[number];

export interface StageWorkflowApplicableOption {
  blockerCode: string | null;
  canStart: boolean;
  name: string;
  workflowId: number;
}

export interface StageWorkflowApplicableOptions {
  objectType: string;
  recordId: number;
  workflows: StageWorkflowApplicableOption[];
}

export interface StageWorkflowRecordTask {
  name: string;
  required: boolean;
}

export interface StageWorkflowCurrentStage {
  name: string;
  order: number;
  tasks: StageWorkflowRecordTask[];
}

export interface StageWorkflowAdvanceSelection {
  code: string;
  name: string;
}

export interface StageWorkflowAdvanceTask {
  code: string;
  name: string;
  required: boolean;
}

export const stageWorkflowAdvanceEditableFieldTypes = [
  "TEXT",
  "TEXTAREA",
  "SELECT",
  "MULTI_SELECT",
  "DATE",
  "DATETIME",
  "INTEGER",
  "DECIMAL",
  "BOOLEAN",
  "EMAIL",
  "PHONE",
  "URL",
] as const;

export type StageWorkflowAdvanceEditableFieldType =
  (typeof stageWorkflowAdvanceEditableFieldTypes)[number];

export interface StageWorkflowAdvanceFieldOption {
  label: string;
  value: string;
}

export interface StageWorkflowAdvanceField {
  allowedValues: StageWorkflowAdvanceFieldOption[];
  currentValues: string[];
  displayName: string;
  fieldCode: string;
  fieldType: StageWorkflowAdvanceEditableFieldType;
  required: boolean;
}

export const stageWorkflowCandidateFieldTypes = ["USER", "DEPARTMENT", "RELATION"] as const;
export type StageWorkflowCandidateFieldType = (typeof stageWorkflowCandidateFieldTypes)[number];

export interface StageWorkflowCandidateField {
  currentIds: number[];
  displayName: string;
  fieldCode: string;
  fieldType: StageWorkflowCandidateFieldType;
  required: boolean;
}

const stageWorkflowAddressPartCodes = [
  "country",
  "region",
  "city",
  "postalCode",
  "addressLine",
  "longitude",
  "latitude",
] as const;

export type StageWorkflowAddressPartCode = (typeof stageWorkflowAddressPartCodes)[number];

export interface StageWorkflowAddressPart {
  code: StageWorkflowAddressPartCode;
  displayName: string;
  maxLength: number;
  required: boolean;
}

export interface StageWorkflowAddressValue {
  addressLine: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  postalCode?: string;
  region?: string;
}

export interface StageWorkflowAddressField {
  currentAddress: StageWorkflowAddressValue | null;
  displayName: string;
  fieldCode: string;
  parts: StageWorkflowAddressPart[];
  required: boolean;
}

export interface StageWorkflowFileField {
  displayName: string;
  fieldCode: string;
  required: boolean;
}

export interface StageWorkflowFileDraft {
  draftId: number;
  expiresAt: string;
  fieldCode: string;
  version: number;
  workflowRecordId: number;
}

export const stageWorkflowUploadedFileStatuses = ["PENDING", "UPLOADED", "FAILED"] as const;
export type StageWorkflowUploadedFileStatus = (typeof stageWorkflowUploadedFileStatuses)[number];

export interface StageWorkflowUploadedFile {
  displayName: string;
  fileId: number;
  mediaType: string;
  size: number;
  status: StageWorkflowUploadedFileStatus;
}

export interface StageWorkflowFieldCandidate {
  displayName: string;
  id: number;
  valueType: "ACTOR_ID" | "DEPARTMENT_ID" | "RELATION_ID";
}

export interface StageWorkflowFieldCandidatePage {
  candidates: StageWorkflowFieldCandidate[];
  total: number | null;
}

export interface StageWorkflowOutcome {
  code: "FAILED";
  label: string;
  remarkMaxLength: number;
  remarkRequired: boolean;
}

export interface StageWorkflowRecord {
  advanceAddressFields: StageWorkflowAddressField[];
  advanceFields: StageWorkflowAdvanceField[];
  advanceCandidateFields: StageWorkflowCandidateField[];
  advanceFileFields: StageWorkflowFileField[];
  advanceSelections: StageWorkflowAdvanceSelection[];
  advanceTasks: StageWorkflowAdvanceTask[];
  canAdvanceWithFields: boolean;
  canAdvanceWithoutInput: boolean;
  canAdvanceWithSelections: boolean;
  canAdvanceWithTasks: boolean;
  canComment: boolean;
  canFail: boolean;
  currentStage: StageWorkflowCurrentStage | null;
  hasApprovalGate: boolean;
  hasUnsupportedAdvanceFields: boolean;
  id: number;
  objectType: string;
  outcomes: StageWorkflowOutcome[];
  recordId: number;
  status: StageWorkflowRecordStatus;
  version: number | null;
  workflowId: number;
}

const stageWorkflowRecordActions = ["ADVANCE", "FAIL", "COMMENT"] as const;

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function optionalNonBlankString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return nonBlankString(value) ?? undefined;
}

function isRecordStatus(value: unknown): value is StageWorkflowRecordStatus {
  return (
    typeof value === "string" &&
    stageWorkflowRecordStatuses.includes(value as StageWorkflowRecordStatus)
  );
}

function isRecordAction(value: unknown): value is (typeof stageWorkflowRecordActions)[number] {
  return (
    typeof value === "string" &&
    stageWorkflowRecordActions.includes(value as (typeof stageWorkflowRecordActions)[number])
  );
}

function toAdvanceSelection(value: unknown): StageWorkflowAdvanceSelection | null {
  const source = recordOf(value);
  const code = source === null ? null : nonBlankString(source.code);
  const name = source === null ? null : nonBlankString(source.name);
  return code === null || name === null ? null : { code, name };
}

function isCustomFieldType(value: unknown): value is CustomFieldType {
  return typeof value === "string" && customFieldTypes.includes(value as CustomFieldType);
}

function isAdvanceEditableFieldType(
  value: unknown,
): value is StageWorkflowAdvanceEditableFieldType {
  return (
    typeof value === "string" &&
    stageWorkflowAdvanceEditableFieldTypes.includes(value as StageWorkflowAdvanceEditableFieldType)
  );
}

function isAddressPartCode(value: unknown): value is StageWorkflowAddressPartCode {
  return (
    typeof value === "string" &&
    stageWorkflowAddressPartCodes.includes(value as StageWorkflowAddressPartCode)
  );
}

function toAddressParts(value: unknown): StageWorkflowAddressPart[] | null {
  if (!Array.isArray(value)) return null;
  const parts: StageWorkflowAddressPart[] = [];
  for (const item of value) {
    const source = recordOf(item);
    const code = source === null ? null : source.code;
    const displayName = source === null ? null : nonBlankString(source.displayName);
    const maxLength = source === null ? null : positiveInteger(source.maxLength);
    if (
      !isAddressPartCode(code) ||
      displayName === null ||
      maxLength === null ||
      typeof source?.required !== "boolean" ||
      parts.some((item) => item.code === code)
    ) {
      return null;
    }
    parts.push({ code, displayName, maxLength, required: source.required });
  }
  return parts;
}

function isBaseFieldInput(
  value: unknown,
  fieldType: StageWorkflowAdvanceEditableFieldType,
): boolean {
  const input = recordOf(value);
  const expectedInputType =
    fieldType === "SELECT" || fieldType === "MULTI_SELECT" ? "OPTION_VALUES" : "SCALAR_VALUES";
  return (
    input !== null &&
    input.supported === true &&
    input.candidatesRequired === false &&
    input.fileDraftRequired === false &&
    input.inputType === expectedInputType &&
    input.relationObjectType === undefined &&
    input.blockerCode === undefined &&
    Array.isArray(input.addressParts) &&
    input.addressParts.length === 0
  );
}

function toAdvanceField(value: unknown): StageWorkflowAdvanceField | "unsupported" | null {
  const source = recordOf(value);
  const fieldCode = source === null ? null : nonBlankString(source.fieldCode);
  const displayName = source === null ? null : nonBlankString(source.displayName);
  if (
    source === null ||
    fieldCode === null ||
    displayName === null ||
    typeof source.required !== "boolean" ||
    source.masked !== false ||
    !isCustomFieldType(source.fieldType)
  ) {
    return null;
  }
  if (!isAdvanceEditableFieldType(source.fieldType)) return "unsupported";
  if (!isBaseFieldInput(source.input, source.fieldType)) return null;
  if (!Array.isArray(source.allowedValues) || !Array.isArray(source.currentValues)) return null;
  const allowedValues: StageWorkflowAdvanceFieldOption[] = [];
  for (const value of source.allowedValues) {
    const option = recordOf(value);
    const optionValue = option === null ? null : nonBlankString(option.value);
    const label = option === null ? null : nonBlankString(option.label);
    if (
      optionValue === null ||
      label === null ||
      allowedValues.some((item) => item.value === optionValue)
    ) {
      return null;
    }
    allowedValues.push({ label, value: optionValue });
  }
  if (
    !source.currentValues.every((currentValue) => nonBlankString(currentValue) !== null) ||
    (source.fieldType !== "MULTI_SELECT" && source.currentValues.length > 1) ||
    ((source.fieldType === "SELECT" || source.fieldType === "MULTI_SELECT") &&
      (allowedValues.length === 0 ||
        source.currentValues.some(
          (currentValue) => !allowedValues.some((option) => option.value === currentValue),
        ))) ||
    (source.fieldType === "BOOLEAN" &&
      source.currentValues.some(
        (currentValue) => currentValue !== "true" && currentValue !== "false",
      ))
  ) {
    return null;
  }
  return {
    allowedValues,
    currentValues: [...source.currentValues],
    displayName,
    fieldCode,
    fieldType: source.fieldType,
    required: source.required,
  };
}

function toAdvanceFields(
  values: unknown,
  writableFieldCodes: ReadonlySet<string>,
): {
  addressFields: StageWorkflowAddressField[];
  candidateFields: StageWorkflowCandidateField[];
  fields: StageWorkflowAdvanceField[];
  fileFields: StageWorkflowFileField[];
  hasUnsupported: boolean;
} | null {
  if (!Array.isArray(values)) return null;
  const fields: StageWorkflowAdvanceField[] = [];
  const candidateFields: StageWorkflowCandidateField[] = [];
  const addressFields: StageWorkflowAddressField[] = [];
  const fileFields: StageWorkflowFileField[] = [];
  let hasUnsupported = false;
  for (const value of values) {
    const field = toAdvanceField(value);
    if (field === null) return null;
    if (field === "unsupported") {
      const candidateField = toCandidateField(value);
      const addressField = candidateField === null ? toAddressField(value) : null;
      const fileField =
        candidateField === null && addressField === null ? toFileField(value) : null;
      if (candidateField === null && addressField === null && fileField === null)
        hasUnsupported = true;
      else if (
        candidateField !== null &&
        (!writableFieldCodes.has(candidateField.fieldCode) ||
          candidateFields.some((item) => item.fieldCode === candidateField.fieldCode))
      ) {
        return null;
      } else if (
        addressField !== null &&
        (!writableFieldCodes.has(addressField.fieldCode) ||
          addressFields.some((item) => item.fieldCode === addressField.fieldCode))
      ) {
        return null;
      } else if (
        fileField !== null &&
        (!writableFieldCodes.has(fileField.fieldCode) ||
          fileFields.some((item) => item.fieldCode === fileField.fieldCode))
      ) {
        return null;
      } else if (candidateField !== null) candidateFields.push(candidateField);
      else if (addressField !== null) addressFields.push(addressField);
      else if (fileField !== null) fileFields.push(fileField);
      continue;
    }
    if (
      !writableFieldCodes.has(field.fieldCode) ||
      fields.some((item) => item.fieldCode === field.fieldCode)
    ) {
      return null;
    }
    fields.push(field);
  }
  return hasUnsupported ||
    fields.length + candidateFields.length + addressFields.length + fileFields.length !==
      writableFieldCodes.size ||
    fileFields.length > 1
    ? {
        addressFields: [],
        candidateFields: [],
        fields: [],
        fileFields: [],
        hasUnsupported: true,
      }
    : { addressFields, candidateFields, fields, fileFields, hasUnsupported: false };
}

function toCandidateField(value: unknown): StageWorkflowCandidateField | null {
  const source = recordOf(value);
  const fieldType = source === null ? null : source.fieldType;
  const fieldCode = source === null ? null : nonBlankString(source.fieldCode);
  const displayName = source === null ? null : nonBlankString(source.displayName);
  const input = source === null ? null : recordOf(source.input);
  if (
    source === null ||
    fieldCode === null ||
    displayName === null ||
    typeof source.required !== "boolean" ||
    source.masked !== false ||
    !stageWorkflowCandidateFieldTypes.includes(fieldType as StageWorkflowCandidateFieldType) ||
    input === null ||
    input.supported !== true ||
    input.candidatesRequired !== true ||
    input.fileDraftRequired !== false ||
    !Array.isArray(input.addressParts) ||
    input.addressParts.length !== 0 ||
    !Array.isArray(source.allowedValues) ||
    source.allowedValues.length !== 0 ||
    !Array.isArray(source.currentValues)
  ) {
    return null;
  }
  const expectedInput =
    fieldType === "USER"
      ? "ACTOR_IDS"
      : fieldType === "DEPARTMENT"
        ? "DEPARTMENT_IDS"
        : "RELATION_IDS";
  if (input.inputType !== expectedInput) return null;
  const currentIds = source.currentValues.map((item) => {
    const numeric = nonBlankString(item);
    return numeric === null || !/^[1-9]\d*$/.test(numeric) ? null : Number(numeric);
  });
  if (
    currentIds.some((id) => id === null || !Number.isSafeInteger(id)) ||
    new Set(currentIds).size !== currentIds.length
  ) {
    return null;
  }
  return {
    currentIds: currentIds as number[],
    displayName,
    fieldCode,
    fieldType: fieldType as StageWorkflowCandidateFieldType,
    required: source.required,
  };
}

function toAddressValue(value: unknown): StageWorkflowAddressValue | null {
  const source = recordOf(value);
  const addressLine = source === null ? null : nonBlankString(source.addressLine);
  if (source === null || addressLine === null) return null;
  const stringParts = ["country", "region", "city", "postalCode"] as const;
  const result: StageWorkflowAddressValue = { addressLine };
  for (const part of stringParts) {
    const partValue = source[part];
    if (partValue === undefined) continue;
    const parsed = nonBlankString(partValue);
    if (parsed === null) return null;
    result[part] = parsed;
  }
  for (const part of ["longitude", "latitude"] as const) {
    const partValue = source[part];
    if (partValue === undefined) continue;
    if (typeof partValue !== "number" || !Number.isFinite(partValue)) return null;
    result[part] = partValue;
  }
  return result;
}

function toAddressField(value: unknown): StageWorkflowAddressField | null {
  const source = recordOf(value);
  const fieldCode = source === null ? null : nonBlankString(source.fieldCode);
  const displayName = source === null ? null : nonBlankString(source.displayName);
  const input = source === null ? null : recordOf(source.input);
  const parts = input === null ? null : toAddressParts(input.addressParts);
  const currentAddress =
    source?.currentAddress === undefined ? null : toAddressValue(source.currentAddress);
  if (
    source === null ||
    fieldCode === null ||
    displayName === null ||
    source.fieldType !== "ADDRESS" ||
    typeof source.required !== "boolean" ||
    source.masked !== false ||
    input === null ||
    input.supported !== true ||
    input.candidatesRequired !== false ||
    input.fileDraftRequired !== false ||
    input.inputType !== "ADDRESS" ||
    input.relationObjectType !== undefined ||
    input.blockerCode !== undefined ||
    parts === null ||
    !parts.some((part) => part.code === "addressLine") ||
    !Array.isArray(source.allowedValues) ||
    source.allowedValues.length !== 0 ||
    !Array.isArray(source.currentValues) ||
    source.currentValues.length !== 0 ||
    (source.currentAddress !== undefined && currentAddress === null) ||
    (currentAddress !== null &&
      Object.keys(currentAddress).some(
        (part) => !parts.some((candidate) => candidate.code === part),
      ))
  ) {
    return null;
  }
  return { currentAddress, displayName, fieldCode, parts, required: source.required };
}

function toFileField(value: unknown): StageWorkflowFileField | null {
  const source = recordOf(value);
  const fieldCode = source === null ? null : nonBlankString(source.fieldCode);
  const displayName = source === null ? null : nonBlankString(source.displayName);
  const input = source === null ? null : recordOf(source.input);
  if (
    source === null ||
    fieldCode === null ||
    displayName === null ||
    source.fieldType !== "FILE" ||
    typeof source.required !== "boolean" ||
    source.masked !== false ||
    input === null ||
    input.supported !== true ||
    input.candidatesRequired !== false ||
    input.fileDraftRequired !== true ||
    input.inputType !== "FILE_DRAFT" ||
    input.relationObjectType !== undefined ||
    input.blockerCode !== undefined ||
    !Array.isArray(input.addressParts) ||
    input.addressParts.length !== 0 ||
    !Array.isArray(source.allowedValues) ||
    source.allowedValues.length !== 0 ||
    !Array.isArray(source.currentValues) ||
    source.currentValues.length !== 0 ||
    source.currentAddress !== undefined
  ) {
    return null;
  }
  return { displayName, fieldCode, required: source.required };
}

export function toStageWorkflowFieldCandidatePage(
  value: unknown,
): StageWorkflowFieldCandidatePage | null {
  const source = recordOf(value);
  const total =
    source === null ? null : source.totalNum === -1 ? null : nonNegativeInteger(source.totalNum);
  if (source === null || total === null || !Array.isArray(source.objectList)) return null;
  const candidates: StageWorkflowFieldCandidate[] = [];
  for (const value of source.objectList) {
    const candidate = recordOf(value);
    const id = candidate === null ? null : positiveInteger(candidate.id);
    const displayName = candidate === null ? null : nonBlankString(candidate.displayName);
    const valueType = candidate === null ? null : candidate.valueType;
    if (
      id === null ||
      displayName === null ||
      (valueType !== "ACTOR_ID" && valueType !== "DEPARTMENT_ID" && valueType !== "RELATION_ID") ||
      candidates.some((item) => item.id === id)
    ) {
      return null;
    }
    candidates.push({ displayName, id, valueType });
  }
  return { candidates, total };
}

/** Decodes the server-issued, record-scoped FILE draft required by a stage advance. */
export function toStageWorkflowFileDraft(value: unknown): StageWorkflowFileDraft | null {
  const source = recordOf(value);
  const draftId = source === null ? null : positiveInteger(source.draftId);
  const workflowRecordId = source === null ? null : positiveInteger(source.workflowRecordId);
  const fieldCode = source === null ? null : nonBlankString(source.fieldCode);
  const version = source === null ? null : nonNegativeInteger(source.version);
  const expiresAt = source === null ? null : isoDateTime(source.expiresAt);
  if (
    source === null ||
    draftId === null ||
    workflowRecordId === null ||
    fieldCode === null ||
    version === null ||
    expiresAt === null
  ) {
    return null;
  }
  return { draftId, expiresAt, fieldCode, version, workflowRecordId };
}

/** Keeps only the final upload-state facts necessary to decide whether FILE IDs may be advanced. */
export function toStageWorkflowUploadedFile(value: unknown): StageWorkflowUploadedFile | null {
  const source = recordOf(value);
  const fileId = source === null ? null : positiveInteger(source.fileId);
  const displayName = source === null ? null : nonBlankString(source.displayName);
  const mediaType = source === null ? null : nonBlankString(source.mediaType);
  const size = source === null ? null : nonNegativeInteger(source.size);
  const status = source === null ? null : source.status;
  if (
    source === null ||
    fileId === null ||
    displayName === null ||
    mediaType === null ||
    size === null ||
    !stageWorkflowUploadedFileStatuses.includes(status as StageWorkflowUploadedFileStatus)
  ) {
    return null;
  }
  return {
    displayName,
    fileId,
    mediaType,
    size,
    status: status as StageWorkflowUploadedFileStatus,
  };
}

function toOutcomes(values: unknown): StageWorkflowOutcome[] | null {
  if (!Array.isArray(values)) return null;
  const outcomes: StageWorkflowOutcome[] = [];
  for (const value of values) {
    const source = recordOf(value);
    const label = source === null ? null : nonBlankString(source.label);
    const remarkMaxLength = source === null ? null : positiveInteger(source.remarkMaxLength);
    if (
      source === null ||
      source.code !== "FAILED" ||
      label === null ||
      remarkMaxLength === null ||
      typeof source.remarkRequired !== "boolean" ||
      outcomes.some((item) => item.code === source.code)
    ) {
      return null;
    }
    outcomes.push({
      code: source.code,
      label,
      remarkMaxLength,
      remarkRequired: source.remarkRequired,
    });
  }
  return outcomes;
}

function toApplicableOption(value: unknown): StageWorkflowApplicableOption | null {
  const source = recordOf(value);
  const workflowId = source === null ? null : positiveInteger(source.workflowId);
  const name = source === null ? null : nonBlankString(source.name);
  const blockerCode = source === null ? undefined : optionalNonBlankString(source.blockerCode);
  if (
    source === null ||
    workflowId === null ||
    name === null ||
    blockerCode === undefined ||
    typeof source.canStart !== "boolean"
  ) {
    return null;
  }
  return { blockerCode, canStart: source.canStart, name, workflowId };
}

/** Keeps only the current record's server-confirmed workflow applicability and startability. */
export function toStageWorkflowApplicableOptions(
  value: unknown,
): StageWorkflowApplicableOptions | null {
  const source = recordOf(value);
  const objectType = source === null ? null : nonBlankString(source.objectType);
  const recordId = source === null ? null : positiveInteger(source.recordId);
  if (
    source === null ||
    objectType === null ||
    recordId === null ||
    !Array.isArray(source.workflows)
  ) {
    return null;
  }

  const workflows: StageWorkflowApplicableOption[] = [];
  for (const value of source.workflows) {
    const workflow = toApplicableOption(value);
    if (workflow === null || workflows.some((item) => item.workflowId === workflow.workflowId)) {
      return null;
    }
    workflows.push(workflow);
  }
  return { objectType, recordId, workflows };
}

function toCurrentStage(value: unknown): StageWorkflowCurrentStage | null {
  const source = recordOf(value);
  const name = source === null ? null : nonBlankString(source.name);
  const order = source === null ? null : positiveInteger(source.order);
  if (source === null || name === null || order === null) return null;

  const tasksSource = source.tasks;
  if (tasksSource !== undefined && !Array.isArray(tasksSource)) return null;
  const tasks: StageWorkflowRecordTask[] = [];
  for (const value of tasksSource ?? []) {
    const task = recordOf(value);
    const taskName = task === null ? null : nonBlankString(task.name);
    if (taskName === null || typeof task?.required !== "boolean") return null;
    tasks.push({ name: taskName, required: task.required });
  }
  return { name, order, tasks };
}

function toAdvanceTasks(
  currentStageValue: unknown,
  allowedTaskCodes: ReadonlySet<string>,
): StageWorkflowAdvanceTask[] | null {
  if (allowedTaskCodes.size === 0) return [];
  const source = recordOf(currentStageValue);
  if (source === null || !Array.isArray(source.tasks)) return null;

  const tasks: StageWorkflowAdvanceTask[] = [];
  for (const value of source.tasks) {
    const task = recordOf(value);
    if (task === null) continue;
    const code = nonBlankString(task.code);
    const name = nonBlankString(task.name);
    if (code === null || name === null || typeof task.required !== "boolean") continue;
    if (!allowedTaskCodes.has(code)) continue;
    if (tasks.some((item) => item.code === code)) return null;
    tasks.push({ code, name, required: task.required });
  }
  return tasks.length === allowedTaskCodes.size ? tasks : null;
}

/**
 * Decodes a safe running-record projection. COMMENT, eligible ADVANCE booleans, and ADVANCE-only
 * selection/task/basic-field projections survive; approval IDs, timestamps, attachments, progress,
 * and outcome remarks are intentionally dropped.
 */
export function toStageWorkflowRecord(value: unknown): StageWorkflowRecord | null {
  const source = recordOf(value);
  const id = source === null ? null : positiveInteger(source.id);
  const workflowId = source === null ? null : positiveInteger(source.workflowId);
  const objectType = source === null ? null : nonBlankString(source.objectType);
  const recordId = source === null ? null : positiveInteger(source.recordId);
  const version =
    source === null || source.version === undefined || source.version === null
      ? null
      : nonNegativeInteger(source.version);
  const hasCurrentStage =
    source !== null && source.currentStage !== undefined && source.currentStage !== null;
  const currentStage =
    hasCurrentStage && source !== null ? toCurrentStage(source.currentStage) : null;
  const approvalGate = source === null ? undefined : source.approvalGate;
  const approvalGateSource =
    approvalGate === undefined || approvalGate === null ? null : recordOf(approvalGate);
  const approvalGateStatus =
    approvalGateSource === null ? null : nonBlankString(approvalGateSource.status);
  const approvalSelectionsSource =
    approvalGateSource === null ? null : approvalGateSource.approverSelections;
  const approvalSelections: StageWorkflowAdvanceSelection[] | null =
    approvalSelectionsSource === null
      ? []
      : Array.isArray(approvalSelectionsSource)
        ? approvalSelectionsSource.flatMap((value) => {
            const selection = toAdvanceSelection(value);
            return selection === null ? [] : [selection];
          })
        : null;
  const allowedActions =
    source === null || !Array.isArray(source.allowedActions)
      ? null
      : source.allowedActions.every(isRecordAction)
        ? new Set(source.allowedActions)
        : null;
  const outcomesSource = source === null ? undefined : source.allowedOutcomes;
  const outcomes = outcomesSource === undefined ? [] : toOutcomes(outcomesSource);
  const currentStageRequired =
    source !== null && (source.status === "ACTIVE" || source.status === "AWAITING_APPROVAL");
  const writableFieldCodesSource = source === null ? null : source.writableFieldCodes;
  const writableFieldCodes =
    writableFieldCodesSource === null || !Array.isArray(writableFieldCodesSource)
      ? null
      : writableFieldCodesSource.every((code) => nonBlankString(code) !== null)
        ? new Set(writableFieldCodesSource)
        : null;
  const advanceFieldResult =
    writableFieldCodes === null || source === null
      ? null
      : toAdvanceFields(source.writableFields, writableFieldCodes);
  const allowedTaskCodesSource = source === null ? null : source.allowedTaskCodes;
  const allowedTaskCodes =
    allowedTaskCodesSource === null || !Array.isArray(allowedTaskCodesSource)
      ? null
      : allowedTaskCodesSource.every((code) => nonBlankString(code) !== null)
        ? new Set(allowedTaskCodesSource)
        : null;
  const advanceTasks =
    allowedTaskCodes === null || source === null
      ? null
      : toAdvanceTasks(source.currentStage, allowedTaskCodes);
  if (
    source === null ||
    id === null ||
    workflowId === null ||
    allowedActions === null ||
    outcomes === null ||
    (allowedActions?.has("FAIL") && outcomesSource === undefined) ||
    (source.version !== undefined && source.version !== null && version === null) ||
    objectType === null ||
    recordId === null ||
    (hasCurrentStage && currentStage === null) ||
    (currentStageRequired && currentStage === null) ||
    !isRecordStatus(source.status) ||
    (approvalGate !== undefined && approvalGate !== null && approvalGateStatus === null) ||
    approvalSelections === null ||
    approvalSelections.length !==
      (Array.isArray(approvalSelectionsSource) ? approvalSelectionsSource.length : 0) ||
    new Set(approvalSelections.map((selection) => selection.code)).size !==
      approvalSelections.length ||
    writableFieldCodes === null ||
    writableFieldCodes.size !==
      (Array.isArray(writableFieldCodesSource) ? writableFieldCodesSource.length : 0) ||
    advanceFieldResult === null ||
    allowedTaskCodes === null ||
    allowedTaskCodes.size !==
      (Array.isArray(allowedTaskCodesSource) ? allowedTaskCodesSource.length : 0) ||
    advanceTasks === null
  ) {
    return null;
  }

  return {
    advanceAddressFields: allowedActions.has("ADVANCE") ? advanceFieldResult.addressFields : [],
    advanceCandidateFields: allowedActions.has("ADVANCE") ? advanceFieldResult.candidateFields : [],
    advanceFields: allowedActions.has("ADVANCE") ? advanceFieldResult.fields : [],
    advanceFileFields: allowedActions.has("ADVANCE") ? advanceFieldResult.fileFields : [],
    advanceSelections: allowedActions.has("ADVANCE") ? approvalSelections : [],
    advanceTasks: allowedActions.has("ADVANCE") ? advanceTasks : [],
    canAdvanceWithFields:
      allowedActions.has("ADVANCE") &&
      version !== null &&
      (advanceFieldResult.fields.length > 0 ||
        advanceFieldResult.candidateFields.length > 0 ||
        advanceFieldResult.addressFields.length > 0 ||
        advanceFieldResult.fileFields.length > 0) &&
      !advanceFieldResult.hasUnsupported,
    canAdvanceWithoutInput:
      allowedActions.has("ADVANCE") &&
      version !== null &&
      advanceFieldResult.fields.length === 0 &&
      advanceFieldResult.candidateFields.length === 0 &&
      advanceFieldResult.addressFields.length === 0 &&
      advanceFieldResult.fileFields.length === 0 &&
      !advanceFieldResult.hasUnsupported &&
      advanceTasks.length === 0 &&
      approvalSelections.length === 0,
    canAdvanceWithSelections:
      allowedActions.has("ADVANCE") &&
      version !== null &&
      advanceFieldResult.fields.length === 0 &&
      advanceFieldResult.candidateFields.length === 0 &&
      advanceFieldResult.addressFields.length === 0 &&
      advanceFieldResult.fileFields.length === 0 &&
      !advanceFieldResult.hasUnsupported &&
      advanceTasks.length === 0 &&
      approvalSelections.length > 0,
    canAdvanceWithTasks:
      allowedActions.has("ADVANCE") &&
      version !== null &&
      advanceFieldResult.fields.length === 0 &&
      advanceFieldResult.candidateFields.length === 0 &&
      advanceFieldResult.addressFields.length === 0 &&
      advanceFieldResult.fileFields.length === 0 &&
      !advanceFieldResult.hasUnsupported &&
      advanceTasks.length > 0,
    canComment: allowedActions.has("COMMENT"),
    canFail: allowedActions.has("FAIL") && version !== null && outcomes.length > 0,
    currentStage,
    hasApprovalGate: approvalGateStatus !== null && approvalGateStatus !== "NOT_REQUIRED",
    hasUnsupportedAdvanceFields: allowedActions.has("ADVANCE") && advanceFieldResult.hasUnsupported,
    id,
    objectType,
    outcomes: allowedActions.has("FAIL") ? outcomes : [],
    recordId,
    status: source.status,
    version,
    workflowId,
  };
}

/** Accepts a write response only when it contains a complete running-record projection. */
export function toStageWorkflowActionRecord(value: unknown): StageWorkflowRecord | null {
  const source = recordOf(value);
  return source === null ? null : toStageWorkflowRecord(source.record);
}
