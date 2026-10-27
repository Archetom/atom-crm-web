import type { components } from "~/api/generated/schema";
import { nonBlankString, positiveInteger, recordOf } from "~/shared/utils/decode";

export const stageWorkflowObjectTypes = ["CUSTOMER", "CONTACT", "LEAD", "OPPORTUNITY"] as const;
export type StageWorkflowObjectType = (typeof stageWorkflowObjectTypes)[number];

export const stageWorkflowConfigurationCandidateTypes = ["MEMBER", "DEPARTMENT"] as const;
export type StageWorkflowConfigurationCandidateType =
  (typeof stageWorkflowConfigurationCandidateTypes)[number];

export const stageWorkflowDefinitionStatuses = ["ACTIVE", "INACTIVE", "DELETED"] as const;
export type StageWorkflowDefinitionStatus = (typeof stageWorkflowDefinitionStatuses)[number];

export interface StageWorkflowConfigurationObjectType {
  code: StageWorkflowObjectType;
  displayName: string;
}

export interface StageWorkflowConfigurationField {
  blockerCode: string | null;
  code: string;
  displayName: string;
  fieldType: string;
  requiredFieldEligible: boolean;
  writable: boolean;
}

export interface StageWorkflowConfigurationApprovalDefinition {
  id: number;
  name: string;
  version: number;
}

export interface StageWorkflowConfigurationOptions {
  approvalDefinitions: StageWorkflowConfigurationApprovalDefinition[];
  fields: StageWorkflowConfigurationField[];
  objectTypes: StageWorkflowConfigurationObjectType[];
}

export interface StageWorkflowConfigurationCandidate {
  displayName: string;
  id: number;
  valueType: StageWorkflowConfigurationCandidateType;
}

export interface StageWorkflowConfigurationCandidatePage {
  candidates: StageWorkflowConfigurationCandidate[];
  page: number;
  size: number;
  total: number;
}

export interface StageWorkflowConfigurationTask {
  code: string;
  name: string;
  required: boolean;
}

export interface StageWorkflowConfigurationStage {
  approvalDefinitionId: number | null;
  blockerCode: string | null;
  code: string;
  editable: boolean;
  name: string;
  order: number;
  probability: number;
  requiredFieldCodes: string[];
  tasks: StageWorkflowConfigurationTask[];
}

export interface StageWorkflowEditableBaseline {
  allowedStatuses: StageWorkflowDefinitionStatus[];
  applicableActorIds: number[];
  applicableDepartmentIds: number[];
  canChangeStatus: boolean;
  canUpdate: boolean;
  failureName: string;
  id: number;
  name: string;
  objectType: StageWorkflowObjectType;
  stages: StageWorkflowConfigurationStage[];
  status: StageWorkflowDefinitionStatus;
  successName: string;
  version: number;
}

export interface StageWorkflowConfigurationValues {
  applicableActorIds: readonly number[];
  applicableDepartmentIds: readonly number[];
  failureName: string;
  name: string;
  objectType: StageWorkflowObjectType;
  stages: readonly StageWorkflowConfigurationStage[];
  successName: string;
}

export interface StageWorkflowMutationResult {
  id: number;
  status: StageWorkflowDefinitionStatus;
  version: number;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function uniqueStrings(value: unknown, maximum: number): string[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const values = value.map(nonBlankString);
  if (values.some((item) => item === null)) return null;
  const complete = values as string[];
  return new Set(complete).size === complete.length ? complete : null;
}

function uniquePositiveIds(value: unknown, maximum: number): number[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const values = value.map(positiveInteger);
  if (values.some((item) => item === null)) return null;
  const complete = values as number[];
  return new Set(complete).size === complete.length ? complete : null;
}

function isDateTime(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function toStageWorkflowConfigurationTask(value: unknown): StageWorkflowConfigurationTask | null {
  const source = recordOf(value);
  const code = source === null ? null : nonBlankString(source.code);
  const name = source === null ? null : nonBlankString(source.name);
  if (source === null || code === null || name === null || typeof source.required !== "boolean") {
    return null;
  }
  return { code, name, required: source.required };
}

function toStageWorkflowConfigurationStage(value: unknown): StageWorkflowConfigurationStage | null {
  const source = recordOf(value);
  const code = source === null ? null : nonBlankString(source.code);
  const name = source === null ? null : nonBlankString(source.name);
  const order = source === null ? null : nonNegativeInteger(source.order);
  const probability = source === null ? null : nonNegativeInteger(source.probability);
  const requiredFieldCodes = source === null ? null : uniqueStrings(source.requiredFieldCodes, 100);
  const approvalDefinitionId =
    source?.approvalDefinitionId === undefined
      ? null
      : positiveInteger(source.approvalDefinitionId);
  const blockerCode =
    source?.blockerCode === undefined || source.blockerCode === null
      ? null
      : nonBlankString(source.blockerCode);
  if (
    source === null ||
    code === null ||
    name === null ||
    order === null ||
    order > 10_000 ||
    probability === null ||
    probability > 100 ||
    requiredFieldCodes === null ||
    (source.approvalDefinitionId !== undefined && approvalDefinitionId === null) ||
    (source.blockerCode !== undefined && source.blockerCode !== null && blockerCode === null) ||
    typeof source.editable !== "boolean" ||
    !Array.isArray(source.tasks)
  ) {
    return null;
  }
  const tasks = source.tasks.map(toStageWorkflowConfigurationTask);
  if (
    tasks.some((task) => task === null) ||
    tasks.length > 100 ||
    new Set((tasks as StageWorkflowConfigurationTask[]).map((task) => task.code)).size !==
      tasks.length
  ) {
    return null;
  }
  return {
    approvalDefinitionId,
    blockerCode,
    code,
    editable: source.editable,
    name,
    order,
    probability,
    requiredFieldCodes,
    tasks: tasks as StageWorkflowConfigurationTask[],
  };
}

/** Decodes only the manager-facing definition baseline needed for a full, versioned replacement. */
export function toStageWorkflowEditableBaseline(
  value: unknown,
): StageWorkflowEditableBaseline | null {
  const source = recordOf(value);
  const id = source === null ? null : positiveInteger(source.id);
  const version = source === null ? null : nonNegativeInteger(source.version);
  const name = source === null ? null : nonBlankString(source.name);
  const successName = source === null ? null : nonBlankString(source.successName);
  const failureName = source === null ? null : nonBlankString(source.failureName);
  const actorIds = source === null ? null : uniquePositiveIds(source.applicableActorIds, 500);
  const departmentIds =
    source === null ? null : uniquePositiveIds(source.applicableDepartmentIds, 500);
  const allowedActionsSource = source === null ? null : source.allowedActions;
  const allowedStatuses = source === null ? null : uniqueStrings(source.allowedStatuses, 3);
  if (
    source === null ||
    id === null ||
    version === null ||
    name === null ||
    name.length > 200 ||
    successName === null ||
    successName.length > 100 ||
    failureName === null ||
    failureName.length > 100 ||
    !isOneOf(source.objectType, stageWorkflowObjectTypes) ||
    !isOneOf(source.status, stageWorkflowDefinitionStatuses) ||
    actorIds === null ||
    departmentIds === null ||
    !Array.isArray(allowedActionsSource) ||
    !allowedActionsSource.every((action) => action === "UPDATE" || action === "CHANGE_STATUS") ||
    new Set(allowedActionsSource).size !== allowedActionsSource.length ||
    allowedStatuses === null ||
    !allowedStatuses.every((status) =>
      stageWorkflowDefinitionStatuses.includes(status as StageWorkflowDefinitionStatus),
    ) ||
    new Set(allowedStatuses).size !== allowedStatuses.length ||
    !Array.isArray(source.stages) ||
    source.stages.length > 50 ||
    !isDateTime(source.createdTime) ||
    !isDateTime(source.updatedTime)
  ) {
    return null;
  }
  const stages = source.stages.map(toStageWorkflowConfigurationStage);
  if (
    stages.some((stage) => stage === null) ||
    new Set((stages as StageWorkflowConfigurationStage[]).map((stage) => stage.code)).size !==
      stages.length ||
    new Set((stages as StageWorkflowConfigurationStage[]).map((stage) => stage.order)).size !==
      stages.length
  ) {
    return null;
  }
  const actions = new Set(allowedActionsSource);
  const completeStages = stages as StageWorkflowConfigurationStage[];
  return {
    allowedStatuses: allowedStatuses as StageWorkflowDefinitionStatus[],
    applicableActorIds: actorIds,
    applicableDepartmentIds: departmentIds,
    canChangeStatus: actions.has("CHANGE_STATUS") && allowedStatuses.length > 0,
    canUpdate: actions.has("UPDATE") && completeStages.every((stage) => stage.editable),
    failureName,
    id,
    name,
    objectType: source.objectType,
    stages: completeStages,
    status: source.status,
    successName,
    version,
  };
}

/** Keeps only the permission-scoped configuration catalog supplied by the server. */
export function toStageWorkflowConfigurationOptions(
  value: unknown,
): StageWorkflowConfigurationOptions | null {
  const source = recordOf(value);
  if (
    source === null ||
    !Array.isArray(source.objectTypes) ||
    !Array.isArray(source.fields) ||
    !Array.isArray(source.approvalDefinitions)
  ) {
    return null;
  }
  const objectTypes: StageWorkflowConfigurationObjectType[] = [];
  for (const value of source.objectTypes) {
    const item = recordOf(value);
    const code = item === null ? null : item.code;
    const displayName = item === null ? null : nonBlankString(item.displayName);
    if (
      !isOneOf(code, stageWorkflowObjectTypes) ||
      displayName === null ||
      objectTypes.some((item) => item.code === code)
    ) {
      return null;
    }
    objectTypes.push({ code, displayName });
  }
  const fields: StageWorkflowConfigurationField[] = [];
  for (const value of source.fields) {
    const item = recordOf(value);
    const code = item === null ? null : nonBlankString(item.code);
    const displayName = item === null ? null : nonBlankString(item.displayName);
    const fieldType = item === null ? null : nonBlankString(item.fieldType);
    const blockerCode =
      item?.blockerCode === undefined || item.blockerCode === null
        ? null
        : nonBlankString(item.blockerCode);
    if (
      item === null ||
      code === null ||
      displayName === null ||
      fieldType === null ||
      typeof item.writable !== "boolean" ||
      typeof item.requiredFieldEligible !== "boolean" ||
      (item.blockerCode !== undefined && item.blockerCode !== null && blockerCode === null) ||
      fields.some((field) => field.code === code)
    ) {
      return null;
    }
    fields.push({
      blockerCode,
      code,
      displayName,
      fieldType,
      requiredFieldEligible: item.requiredFieldEligible,
      writable: item.writable,
    });
  }
  const approvalDefinitions: StageWorkflowConfigurationApprovalDefinition[] = [];
  for (const value of source.approvalDefinitions) {
    const item = recordOf(value);
    const id = item === null ? null : positiveInteger(item.id);
    const name = item === null ? null : nonBlankString(item.name);
    const version = item === null ? null : nonNegativeInteger(item.version);
    if (
      id === null ||
      name === null ||
      version === null ||
      approvalDefinitions.some((definition) => definition.id === id)
    ) {
      return null;
    }
    approvalDefinitions.push({ id, name, version });
  }
  return { approvalDefinitions, fields, objectTypes };
}

export function toStageWorkflowConfigurationCandidatePage(
  value: unknown,
  expectedType: StageWorkflowConfigurationCandidateType,
): StageWorkflowConfigurationCandidatePage | null {
  const source = recordOf(value);
  const page = source === null ? null : positiveInteger(source.pageNum);
  const size = source === null ? null : positiveInteger(source.pageSize);
  const total = source === null ? null : nonNegativeInteger(source.totalNum);
  if (
    source === null ||
    page === null ||
    size === null ||
    total === null ||
    !Array.isArray(source.objectList)
  ) {
    return null;
  }
  const candidates: StageWorkflowConfigurationCandidate[] = [];
  for (const value of source.objectList) {
    const item = recordOf(value);
    const id = item === null ? null : positiveInteger(item.id);
    const displayName = item === null ? null : nonBlankString(item.displayName);
    if (
      id === null ||
      displayName === null ||
      item?.valueType !== expectedType ||
      candidates.some((candidate) => candidate.id === id)
    ) {
      return null;
    }
    candidates.push({ displayName, id, valueType: expectedType });
  }
  return { candidates, page, size, total };
}

export function toStageWorkflowMutationResult(value: unknown): StageWorkflowMutationResult | null {
  const source = recordOf(value);
  const id = source === null ? null : positiveInteger(source.id);
  const version = source === null ? null : nonNegativeInteger(source.version);
  if (
    source === null ||
    id === null ||
    version === null ||
    !isOneOf(source.status, stageWorkflowDefinitionStatuses)
  ) {
    return null;
  }
  return { id, status: source.status, version };
}

export function toStageWorkflowConfigurationValues(
  baseline: StageWorkflowEditableBaseline,
): StageWorkflowConfigurationValues {
  return {
    applicableActorIds: baseline.applicableActorIds,
    applicableDepartmentIds: baseline.applicableDepartmentIds,
    failureName: baseline.failureName,
    name: baseline.name,
    objectType: baseline.objectType,
    stages: baseline.stages,
    successName: baseline.successName,
  };
}

function toConfigurationStageRequest(
  value: StageWorkflowConfigurationStage,
  options: StageWorkflowConfigurationOptions,
): components["schemas"]["StageDefinitionRequest"] | null {
  const code = value.code.trim();
  const name = value.name.trim();
  const requiredFieldCodes = uniqueStrings(value.requiredFieldCodes, 100);
  if (
    code.length === 0 ||
    code.length > 64 ||
    name.length === 0 ||
    name.length > 100 ||
    !Number.isSafeInteger(value.order) ||
    value.order < 0 ||
    value.order > 10_000 ||
    !Number.isSafeInteger(value.probability) ||
    value.probability < 0 ||
    value.probability > 100 ||
    requiredFieldCodes === null ||
    requiredFieldCodes.some(
      (fieldCode) =>
        !options.fields.some(
          (field) => field.code === fieldCode && field.writable && field.requiredFieldEligible,
        ),
    ) ||
    value.tasks.length > 100 ||
    (value.approvalDefinitionId !== null &&
      !options.approvalDefinitions.some(
        (definition) => definition.id === value.approvalDefinitionId,
      ))
  ) {
    return null;
  }
  const tasks = value.tasks.map((task) => {
    const taskCode = task.code.trim();
    const taskName = task.name.trim();
    if (
      taskCode.length === 0 ||
      taskCode.length > 64 ||
      taskName.length === 0 ||
      taskName.length > 100 ||
      typeof task.required !== "boolean"
    ) {
      return null;
    }
    return { code: taskCode, name: taskName, required: task.required };
  });
  if (
    tasks.some((task) => task === null) ||
    new Set((tasks as components["schemas"]["StageTaskRequest"][]).map((task) => task.code))
      .size !== tasks.length
  ) {
    return null;
  }
  return {
    ...(value.approvalDefinitionId === null
      ? {}
      : { approvalDefinitionId: value.approvalDefinitionId }),
    code,
    name,
    order: value.order,
    probability: value.probability,
    requiredFieldCodes,
    tasks: tasks as components["schemas"]["StageTaskRequest"][],
  };
}

/** Builds a complete create/update payload only from current server catalogs and a full baseline. */
export function toStageWorkflowConfigurationRequest(
  values: StageWorkflowConfigurationValues,
  options: StageWorkflowConfigurationOptions,
  version?: number,
): components["schemas"]["StageWorkflowRequest"] | null {
  const name = values.name.trim();
  const successName = values.successName.trim();
  const failureName = values.failureName.trim();
  const applicableActorIds = uniquePositiveIds(values.applicableActorIds, 500);
  const applicableDepartmentIds = uniquePositiveIds(values.applicableDepartmentIds, 500);
  if (
    name.length === 0 ||
    name.length > 200 ||
    successName.length === 0 ||
    successName.length > 100 ||
    failureName.length === 0 ||
    failureName.length > 100 ||
    !options.objectTypes.some((objectType) => objectType.code === values.objectType) ||
    applicableActorIds === null ||
    applicableDepartmentIds === null ||
    values.stages.length > 50 ||
    (version !== undefined && (!Number.isSafeInteger(version) || version < 0))
  ) {
    return null;
  }
  const stages = values.stages.map((stage) => toConfigurationStageRequest(stage, options));
  if (
    stages.some((stage) => stage === null) ||
    new Set(
      (stages as components["schemas"]["StageDefinitionRequest"][]).map((stage) => stage.code),
    ).size !== stages.length ||
    new Set(
      (stages as components["schemas"]["StageDefinitionRequest"][]).map((stage) => stage.order),
    ).size !== stages.length
  ) {
    return null;
  }
  return {
    applicableActorIds,
    applicableDepartmentIds,
    failureName,
    name,
    objectType: values.objectType,
    stages: stages as components["schemas"]["StageDefinitionRequest"][],
    successName,
    ...(version === undefined ? {} : { version }),
  };
}
