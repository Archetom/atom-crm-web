import type { components } from "~/api/generated/schema";

import {
  approvalDefinitionObjectTypes,
  type ApprovalDefinitionObjectType,
} from "./approval-definition-list-item";
import { recordOf } from "~/shared/utils/decode";

const editableStepModes = ["ANY", "ALL"] as const;

export type EditableApprovalStepMode = (typeof editableStepModes)[number];

export interface ApprovalDefinitionEditableBaseline {
  approverActorIds: number[];
  id: number;
  managerActorIds: number[];
  name: string;
  objectType: ApprovalDefinitionObjectType;
  stepMode: EditableApprovalStepMode;
  stepName: string;
  version: number;
}

export interface ApprovalDefinitionEditValues {
  approverActorIds: readonly number[];
  managerActorIds: readonly number[];
  name: string;
  stepMode: EditableApprovalStepMode;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nonNegativeVersion(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function uniquePositiveIds(value: unknown, maximum: number, allowEmpty = false): number[] | null {
  if (!Array.isArray(value) || value.length > maximum || (!allowEmpty && value.length === 0)) {
    return null;
  }
  const ids = value.map(positiveIdentifier);
  if (ids.some((id) => id === null)) return null;
  const complete = ids as number[];
  return new Set(complete).size === complete.length ? complete : null;
}

function emptyIds(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.length === 0);
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.some((candidate) => candidate === value);
}

/**
 * Accepts only an inactive, single MEMBER-step template without scopes,
 * conditions, or role routing. Other definitions fail closed instead of being
 * partially re-saved by this limited editor.
 */
export function toApprovalDefinitionEditableBaseline(
  value: unknown,
): ApprovalDefinitionEditableBaseline | null {
  const source = recordOf(value);
  const id = source === null ? null : positiveIdentifier(source.id);
  const version = source === null ? null : nonNegativeVersion(source.version);
  const managers = source === null ? null : uniquePositiveIds(source.managerActorIds, 100);
  if (
    source === null ||
    id === null ||
    version === null ||
    managers === null ||
    source.status !== "INACTIVE" ||
    source.repeatMode !== "ONCE" ||
    !isOneOf(source.objectType, approvalDefinitionObjectTypes) ||
    typeof source.name !== "string" ||
    source.name.trim().length === 0 ||
    !emptyIds(source.initiatorActorIds) ||
    !emptyIds(source.initiatorDepartmentIds) ||
    !Array.isArray(source.steps) ||
    source.steps.length !== 1
  ) {
    return null;
  }

  const step = recordOf(source.steps[0]);
  const approvers = step === null ? null : uniquePositiveIds(step.memberActorIds, 100);
  if (
    step === null ||
    approvers === null ||
    step.code !== "step-1" ||
    step.order !== 0 ||
    step.type !== "MEMBER" ||
    step.fallback !== "MANAGERS" ||
    !isOneOf(step.mode, editableStepModes) ||
    typeof step.name !== "string" ||
    step.name.trim().length === 0 ||
    !emptyIds(step.roleIds) ||
    !emptyIds(step.conditions)
  ) {
    return null;
  }

  return {
    approverActorIds: approvers,
    id,
    managerActorIds: managers,
    name: source.name,
    objectType: source.objectType,
    stepMode: step.mode,
    stepName: step.name,
    version,
  };
}

/** Rebuilds the full replacement payload only from the verified minimal baseline and edited fields. */
export function toApprovalDefinitionUpdateRequest(
  baseline: ApprovalDefinitionEditableBaseline,
  values: ApprovalDefinitionEditValues,
): components["schemas"]["ApprovalDefinitionRequest"] | null {
  const name = values.name.trim();
  const approvers = uniquePositiveIds(values.approverActorIds, 100);
  const managers = uniquePositiveIds(values.managerActorIds, 100);
  if (
    name.length === 0 ||
    name.length > 200 ||
    approvers === null ||
    managers === null ||
    !isOneOf(values.stepMode, editableStepModes)
  ) {
    return null;
  }

  return {
    managerActorIds: managers,
    name,
    objectType: baseline.objectType,
    repeatMode: "ONCE",
    steps: [
      {
        code: "step-1",
        fallback: "MANAGERS",
        memberActorIds: approvers,
        mode: values.stepMode,
        name: baseline.stepName,
        order: 0,
        type: "MEMBER",
      },
    ],
    version: baseline.version,
  };
}
