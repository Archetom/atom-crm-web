import type { components } from "~/api/generated/schema";

import {
  approvalDefinitionObjectTypes,
  type ApprovalDefinitionObjectType,
} from "./approval-definition-list-item";

const approvalStepModes = ["ANY", "ALL"] as const;

export type ApprovalStepMode = (typeof approvalStepModes)[number];

export interface ApprovalDefinitionCreateValues {
  approverActorIds: readonly number[];
  managerActorIds: readonly number[];
  name: string;
  objectType: ApprovalDefinitionObjectType;
  stepMode: ApprovalStepMode;
}

function isOneOf<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return values.includes(value);
}

function positiveDistinctIds(values: readonly number[], maximum: number): number[] | null {
  if (
    values.length === 0 ||
    values.length > maximum ||
    values.some((value) => !Number.isSafeInteger(value) || value <= 0)
  ) {
    return null;
  }

  const distinct = [...new Set(values)];
  return distinct.length === values.length ? distinct : null;
}

/**
 * Builds the deliberately narrow draft template: one member step, manager
 * fallback, no routing conditions, no initiator scopes, and an inactive server
 * lifecycle. The server remains authoritative for every selected member.
 */
export function toApprovalDefinitionCreateRequest(
  values: ApprovalDefinitionCreateValues,
): components["schemas"]["ApprovalDefinitionRequest"] | null {
  const name = values.name.trim();
  const approverActorIds = positiveDistinctIds(values.approverActorIds, 100);
  const managerActorIds = positiveDistinctIds(values.managerActorIds, 100);
  if (
    name.length === 0 ||
    name.length > 200 ||
    approverActorIds === null ||
    managerActorIds === null ||
    !isOneOf(values.objectType, approvalDefinitionObjectTypes) ||
    !isOneOf(values.stepMode, approvalStepModes)
  ) {
    return null;
  }

  return {
    managerActorIds,
    name,
    objectType: values.objectType,
    repeatMode: "ONCE",
    steps: [
      {
        code: "step-1",
        fallback: "MANAGERS",
        memberActorIds: approverActorIds,
        mode: values.stepMode,
        name: "审批成员",
        order: 0,
        type: "MEMBER",
      },
    ],
  };
}
