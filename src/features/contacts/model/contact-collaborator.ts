import { recordOf } from "~/shared/utils/decode";

export type ContactCollaboratorAccess = "READ" | "WRITE";
export type ContactCallerCollaboratorState = "OWNER" | ContactCollaboratorAccess | "NONE";

export interface ContactCollaborator {
  actorId: number;
  access: ContactCollaboratorAccess;
}

export interface ContactCollaboratorBaseline {
  version: number;
  collaborators: readonly ContactCollaborator[];
  callerState: ContactCallerCollaboratorState;
}

function isAccess(value: unknown): value is ContactCollaboratorAccess {
  return value === "READ" || value === "WRITE";
}

function isCallerState(value: unknown): value is ContactCallerCollaboratorState {
  return value === "OWNER" || value === "NONE" || isAccess(value);
}

/**
 * The complete server baseline is the only valid source for a replacement
 * request. A malformed response must not silently remove collaborators.
 */
export function decodeContactCollaboratorBaseline(value: unknown): ContactCollaboratorBaseline {
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
    throw new Error("联系人协作者数据暂时不可用，请稍后重试。");
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
      throw new Error("联系人协作者数据暂时不可用，请稍后重试。");
    }

    actorIds.add(actorId);
    return { actorId, access };
  });

  return { callerState, collaborators, version };
}
