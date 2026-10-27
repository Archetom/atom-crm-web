import { recordOf } from "~/shared/utils/decode";

export interface WorkTaskFollowerBaseline {
  id: number;
  version: number;
  status: "TODO" | "IN_PROGRESS";
  followerActorIds: readonly number[];
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function isOpenStatus(value: unknown): value is WorkTaskFollowerBaseline["status"] {
  return value === "TODO" || value === "IN_PROGRESS";
}

/** Retains the complete versioned follower replacement baseline for a task manager only. */
export function toWorkTaskFollowerBaseline(value: unknown): WorkTaskFollowerBaseline | null {
  const source = recordOf(value);
  if (source === null || !Array.isArray(source.followerActorIds)) return null;

  const id = positiveIdentifier(source.id);
  const version = source.version;
  const followerActorIds = source.followerActorIds.map(positiveIdentifier);
  const uniqueFollowerActorIds = new Set(followerActorIds);
  if (
    id === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    !isOpenStatus(source.status) ||
    followerActorIds.some((actorId) => actorId === null) ||
    followerActorIds.length > 50 ||
    uniqueFollowerActorIds.size !== followerActorIds.length
  ) {
    return null;
  }

  return {
    followerActorIds: followerActorIds as number[],
    id,
    status: source.status,
    version,
  };
}
