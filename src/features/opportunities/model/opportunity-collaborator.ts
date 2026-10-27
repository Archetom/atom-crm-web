import { recordOf } from "~/shared/utils/decode";

export type OpportunityCollaboratorAccess = "READ" | "WRITE";
export type OpportunityCallerCollaboratorState = "OWNER" | OpportunityCollaboratorAccess | "NONE";

export interface OpportunityCollaborator {
  actorId: number;
  access: OpportunityCollaboratorAccess;
}

export interface OpportunityCollaboratorBaseline {
  version: number;
  collaborators: readonly OpportunityCollaborator[];
  callerState: OpportunityCallerCollaboratorState;
}

function isAccess(value: unknown): value is OpportunityCollaboratorAccess {
  return value === "READ" || value === "WRITE";
}

function isCallerState(value: unknown): value is OpportunityCallerCollaboratorState {
  return value === "OWNER" || value === "NONE" || isAccess(value);
}

/**
 * The complete server baseline is the only valid source for a replacement
 * request. A malformed response must not silently remove collaborators.
 */
export function decodeOpportunityCollaboratorBaseline(
  value: unknown,
): OpportunityCollaboratorBaseline {
  const source = recordOf(value);
  const version = source?.version;
  const rawCollaborators = source?.collaborators;
  const callerState = source?.callerState;
  if (
    source === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    !Array.isArray(rawCollaborators) ||
    !isCallerState(callerState)
  ) {
    throw new Error("商机协作者数据暂时不可用，请稍后重试。");
  }

  const actorIds = new Set<number>();
  const collaborators = rawCollaborators.map((item) => {
    const collaborator = recordOf(item);
    const actorId = collaborator?.actorId;
    const access = collaborator?.access;
    if (
      collaborator === null ||
      typeof actorId !== "number" ||
      !Number.isSafeInteger(actorId) ||
      actorId <= 0 ||
      !isAccess(access) ||
      actorIds.has(actorId)
    ) {
      throw new Error("商机协作者数据暂时不可用，请稍后重试。");
    }
    actorIds.add(actorId);
    return { actorId, access };
  });

  return { callerState, collaborators, version };
}
