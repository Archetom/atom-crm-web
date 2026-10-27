import { recordOf } from "~/shared/utils/decode";

export type CustomerCollaboratorAccess = "READ" | "WRITE";
export type CustomerCallerCollaboratorState = "OWNER" | CustomerCollaboratorAccess | "NONE";

export interface CustomerCollaborator {
  actorId: number;
  access: CustomerCollaboratorAccess;
}

export interface CustomerCollaboratorBaseline {
  version: number;
  collaborators: readonly CustomerCollaborator[];
  callerState: CustomerCallerCollaboratorState;
}

function isAccess(value: unknown): value is CustomerCollaboratorAccess {
  return value === "READ" || value === "WRITE";
}

function isCallerState(value: unknown): value is CustomerCallerCollaboratorState {
  return value === "OWNER" || value === "NONE" || isAccess(value);
}

/**
 * The complete server baseline is the only valid source for a replacement
 * request. A malformed response must not silently remove collaborators.
 */
export function decodeCustomerCollaboratorBaseline(value: unknown): CustomerCollaboratorBaseline {
  const baseline = recordOf(value);
  const version = baseline?.version;
  const rawCollaborators = baseline?.collaborators;
  const callerState = baseline?.callerState;
  if (
    baseline === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    !Array.isArray(rawCollaborators) ||
    !isCallerState(callerState)
  ) {
    throw new Error("客户协作者数据暂时不可用，请稍后重试。");
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
      throw new Error("客户协作者数据暂时不可用，请稍后重试。");
    }

    actorIds.add(actorId);
    return { actorId, access };
  });

  return { version, collaborators, callerState };
}
