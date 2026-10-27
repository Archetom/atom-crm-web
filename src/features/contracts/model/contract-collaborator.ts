import { recordOf } from "~/shared/utils/decode";

export type ContractCollaboratorAccess = "READ" | "WRITE";
export type ContractCallerCollaboratorState = "OWNER" | ContractCollaboratorAccess | "NONE";

export interface ContractCollaborator {
  actorId: number;
  access: ContractCollaboratorAccess;
  /** Inclusive ISO-8601 date; null means the collaboration does not expire. */
  effectiveUntil: string | null;
}

export interface ContractCollaboratorBaseline {
  version: number;
  collaborators: readonly ContractCollaborator[];
  callerState: ContractCallerCollaboratorState;
}

function isAccess(value: unknown): value is ContractCollaboratorAccess {
  return value === "READ" || value === "WRITE";
}

function isCallerState(value: unknown): value is ContractCallerCollaboratorState {
  return value === "OWNER" || value === "NONE" || isAccess(value);
}

function isEffectiveUntil(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

/**
 * This endpoint is the only trusted replacement baseline. Fail closed rather
 * than dropping malformed entries before a full collaborator replacement.
 */
export function decodeContractCollaboratorBaseline(value: unknown): ContractCollaboratorBaseline {
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
    throw new Error("合同协作者数据暂时不可用，请稍后重试。");
  }

  const actorIds = new Set<number>();
  const collaborators = rawCollaborators.map((item) => {
    const collaborator = recordOf(item);
    const actorId = collaborator?.actorId;
    const access = collaborator?.access;
    const effectiveUntil = collaborator?.effectiveUntil;
    if (
      collaborator === null ||
      typeof actorId !== "number" ||
      !Number.isSafeInteger(actorId) ||
      actorId <= 0 ||
      !isAccess(access) ||
      !isEffectiveUntil(effectiveUntil) ||
      actorIds.has(actorId)
    ) {
      throw new Error("合同协作者数据暂时不可用，请稍后重试。");
    }
    actorIds.add(actorId);
    return { actorId, access, effectiveUntil };
  });

  return { callerState, collaborators, version };
}
