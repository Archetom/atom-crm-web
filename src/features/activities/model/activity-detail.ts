import { activitySubjectTypes, type ActivitySubjectType } from "./activity-timeline";
import { recordOf } from "~/shared/utils/decode";

export interface ActivityRelation {
  objectType: string;
  recordId: number;
}

export interface ActivityDetail {
  id: number;
  version: number;
  category: string;
  purpose: string | null;
  content: string;
  occurredTime: string;
  nextContactTime: string | null;
  subjectId: number;
  subjectType: ActivitySubjectType;
  relations: readonly ActivityRelation[];
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function requiredText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function toActivitySubjectType(value: unknown): ActivitySubjectType | null {
  return typeof value === "string" && activitySubjectTypes.includes(value as ActivitySubjectType)
    ? (value as ActivitySubjectType)
    : null;
}

function toActivityRelations(value: unknown): readonly ActivityRelation[] | null {
  if (!Array.isArray(value)) return null;

  const relations: ActivityRelation[] = [];
  for (const item of value) {
    const source = recordOf(item);
    const objectType = source === null ? null : requiredText(source.objectType);
    const recordId = source === null ? null : positiveIdentifier(source.recordId);
    if (objectType === null || recordId === null) return null;
    relations.push({ objectType, recordId });
  }
  return relations;
}

/**
 * A complete, server-authorized baseline for a caller-owned follow-up update.
 * Fail closed when the relation collection is incomplete: update replaces it.
 */
export function toActivityDetail(value: unknown): ActivityDetail | null {
  const source = recordOf(value);
  if (source === null || source.kind !== "FOLLOW_UP") return null;

  const id = positiveIdentifier(source.id);
  const version =
    typeof source.version === "number" &&
    Number.isSafeInteger(source.version) &&
    source.version >= 0
      ? source.version
      : null;
  const category = requiredText(source.category);
  const content = requiredText(source.content);
  const occurredTime = requiredText(source.occurredTime);
  const subjectId = positiveIdentifier(source.subjectId);
  const subjectType = toActivitySubjectType(source.subjectType);
  const relations = toActivityRelations(source.relations);
  if (
    id === null ||
    version === null ||
    category === null ||
    content === null ||
    occurredTime === null ||
    subjectId === null ||
    subjectType === null ||
    relations === null
  ) {
    return null;
  }

  return {
    id,
    version,
    category,
    content,
    occurredTime,
    purpose: optionalText(source.purpose),
    nextContactTime: optionalText(source.nextContactTime),
    subjectId,
    subjectType,
    relations,
  };
}
