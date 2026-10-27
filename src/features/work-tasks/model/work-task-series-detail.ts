import {
  isWorkTaskSeriesValue,
  toWorkTaskSeriesActions,
  toWorkTaskSeriesListItem,
  type WorkTaskSeriesAction,
  type WorkTaskSeriesListItem,
} from "./work-task-series-list-item";
import { recordOf } from "~/shared/utils/decode";

export const workTaskSeriesPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type WorkTaskSeriesPriority = (typeof workTaskSeriesPriorities)[number];

export interface WorkTaskSeriesDetail extends WorkTaskSeriesListItem {
  description: string;
  priority: WorkTaskSeriesPriority;
  assigneeActorId: number;
  followerActorIds: readonly number[];
}

export interface WorkTaskSeriesMutationResult {
  id: number;
  version: number;
  status: WorkTaskSeriesListItem["status"];
  allowedActions: readonly WorkTaskSeriesAction[];
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function actorIds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const ids = value.map(positiveIdentifier);
  return ids.some((id) => id === null) || new Set(ids).size !== ids.length
    ? null
    : (ids as number[]);
}

/** Keeps the complete versioned baseline only after the server explicitly grants UPDATE. */
export function toWorkTaskSeriesDetail(value: unknown): WorkTaskSeriesDetail | null {
  const source = recordOf(value);
  const listItem = toWorkTaskSeriesListItem(value);
  if (source === null || listItem === null) return null;

  const assigneeActorId = positiveIdentifier(source.assigneeActorId);
  const followerActorIds = actorIds(source.followerActorIds);
  if (
    typeof source.description !== "string" ||
    !isWorkTaskSeriesValue(source.priority, workTaskSeriesPriorities) ||
    assigneeActorId === null ||
    followerActorIds === null
  ) {
    return null;
  }

  return {
    ...listItem,
    assigneeActorId,
    description: source.description,
    followerActorIds,
    priority: source.priority,
  };
}

export function toWorkTaskSeriesMutationResult(
  value: unknown,
): WorkTaskSeriesMutationResult | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const version = source.version;
  const allowedActions = toWorkTaskSeriesActions(source.allowedActions);
  if (
    id === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    !isWorkTaskSeriesValue(source.status, [
      "DRAFT",
      "ACTIVE",
      "PAUSED",
      "STOPPED",
      "ENDED",
    ] as const) ||
    allowedActions === null
  ) {
    return null;
  }

  return { allowedActions, id, status: source.status, version };
}
