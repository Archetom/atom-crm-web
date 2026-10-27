import { nonBlankString, positiveInteger, recordOf } from "~/shared/utils/decode";

export interface StageWorkflowDefinitionTask {
  name: string;
  required: boolean;
}

export interface StageWorkflowDefinitionStage {
  hasApprovalGate: boolean;
  name: string;
  order: number;
  probability: number;
  requiredFieldCodes: string[];
  tasks: StageWorkflowDefinitionTask[];
}

export interface StageWorkflowDefinitionDetail {
  failureName: string;
  id: number;
  name: string;
  objectType: string;
  stages: StageWorkflowDefinitionStage[];
  successName: string;
  version: number;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const values: string[] = [];
  for (const item of value) {
    const parsed = nonBlankString(item);
    if (parsed === null) return null;
    values.push(parsed);
  }
  return [...new Set(values)];
}

function toStageWorkflowDefinitionTask(value: unknown): StageWorkflowDefinitionTask | null {
  const source = recordOf(value);
  const name = source === null ? null : nonBlankString(source.name);
  if (name === null || typeof source?.required !== "boolean") return null;
  return { name, required: source.required };
}

function toStageWorkflowDefinitionStage(value: unknown): StageWorkflowDefinitionStage | null {
  const source = recordOf(value);
  const name = source === null ? null : nonBlankString(source.name);
  const order = source === null ? null : positiveInteger(source.order);
  const probability = source === null ? null : nonNegativeInteger(source.probability);
  const requiredFieldCodes = source === null ? null : stringArray(source.requiredFieldCodes);
  if (
    source === null ||
    name === null ||
    order === null ||
    probability === null ||
    requiredFieldCodes === null ||
    !Array.isArray(source.tasks)
  ) {
    return null;
  }

  const tasks: StageWorkflowDefinitionTask[] = [];
  for (const value of source.tasks) {
    const task = toStageWorkflowDefinitionTask(value);
    if (task === null) return null;
    tasks.push(task);
  }
  const approvalDefinitionId = source.approvalDefinitionId;
  if (approvalDefinitionId !== undefined && positiveInteger(approvalDefinitionId) === null)
    return null;

  return {
    hasApprovalGate: approvalDefinitionId !== undefined,
    name,
    order,
    probability,
    requiredFieldCodes,
    tasks,
  };
}

/** Drops status, scopes, action capabilities, stage codes, task codes, and approval-definition IDs. */
export function toStageWorkflowDefinitionDetail(
  value: unknown,
): StageWorkflowDefinitionDetail | null {
  const source = recordOf(value);
  const id = source === null ? null : positiveInteger(source.id);
  const name = source === null ? null : nonBlankString(source.name);
  const objectType = source === null ? null : nonBlankString(source.objectType);
  const successName = source === null ? null : nonBlankString(source.successName);
  const failureName = source === null ? null : nonBlankString(source.failureName);
  const version = source === null ? null : nonNegativeInteger(source.version);
  if (
    source === null ||
    id === null ||
    name === null ||
    objectType === null ||
    successName === null ||
    failureName === null ||
    version === null ||
    !Array.isArray(source.stages)
  ) {
    return null;
  }

  const stages: StageWorkflowDefinitionStage[] = [];
  for (const value of source.stages) {
    const stage = toStageWorkflowDefinitionStage(value);
    if (stage === null) return null;
    stages.push(stage);
  }
  if (new Set(stages.map((stage) => stage.order)).size !== stages.length) return null;

  return { failureName, id, name, objectType, stages, successName, version };
}
