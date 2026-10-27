import { recordOf } from "~/shared/utils/decode";

export type LeadCollaboratorAccess = "READ" | "WRITE";
export type LeadCallerCollaboratorState = "OWNER" | LeadCollaboratorAccess | "NONE";

export interface LeadCollaborator {
  actorId: number;
  access: LeadCollaboratorAccess;
}

export interface LeadCollaboratorBaseline {
  version: number;
  collaborators: readonly LeadCollaborator[];
  callerState: LeadCallerCollaboratorState;
}

function isAccess(value: unknown): value is LeadCollaboratorAccess {
  return value === "READ" || value === "WRITE";
}

function isCallerState(value: unknown): value is LeadCallerCollaboratorState {
  return value === "OWNER" || value === "NONE" || isAccess(value);
}

/**
 * The complete server baseline is the only valid source for a replacement
 * request. A malformed response must not silently remove collaborators.
 */
export function decodeLeadCollaboratorBaseline(value: unknown): LeadCollaboratorBaseline {
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
    throw new Error("线索协作者数据暂时不可用，请稍后重试。");
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
      throw new Error("线索协作者数据暂时不可用，请稍后重试。");
    }

    actorIds.add(actorId);
    return { actorId, access };
  });

  return { callerState, collaborators, version };
}
