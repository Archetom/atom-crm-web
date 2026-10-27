import { nonBlankString, positiveInteger, recordOf } from "~/shared/utils/decode";

export interface StageWorkflowComment {
  canDelete: boolean;
  content: string;
  createdTime: string | null;
  id: number;
  version: number;
  workflowRecordId: number;
}

export interface StageWorkflowCommentPage {
  items: StageWorkflowComment[];
  total: number | null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function optionalLocalDateTime(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?$/.exec(value);
  if (match === null) return undefined;

  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day &&
    parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute &&
    parsed.getUTCSeconds() === second
    ? value
    : undefined;
}

/** Drops author, update time, and every comment field not needed for the current record view. */
export function toStageWorkflowComment(value: unknown): StageWorkflowComment | null {
  const source = recordOf(value);
  const id = source === null ? null : positiveInteger(source.id);
  const workflowRecordId = source === null ? null : positiveInteger(source.workflowRecordId);
  const content = source === null ? null : nonBlankString(source.content);
  const version = source === null ? null : nonNegativeInteger(source.version);
  const createdTime = source === null ? undefined : optionalLocalDateTime(source.createdTime);
  if (
    source === null ||
    id === null ||
    workflowRecordId === null ||
    content === null ||
    version === null ||
    createdTime === undefined ||
    typeof source.canDelete !== "boolean"
  ) {
    return null;
  }
  return { canDelete: source.canDelete, content, createdTime, id, version, workflowRecordId };
}

/** Decodes a page only when every comment has the stable baseline needed for safe deletion. */
export function toStageWorkflowCommentPage(value: unknown): StageWorkflowCommentPage | null {
  const source = recordOf(value);
  if (source === null || !Array.isArray(source.objectList)) return null;
  const total =
    source.totalNum === undefined || source.totalNum === null
      ? null
      : nonNegativeInteger(source.totalNum);
  if (total === null && source.totalNum !== undefined && source.totalNum !== null) return null;

  const items: StageWorkflowComment[] = [];
  for (const value of source.objectList) {
    const comment = toStageWorkflowComment(value);
    if (comment === null || items.some((item) => item.id === comment.id)) return null;
    items.push(comment);
  }
  return { items, total };
}

/** Accepts only a deletion response that confirms the exact requested comment. */
export function isStageWorkflowCommentDeleted(value: unknown, commentId: number): boolean {
  const source = recordOf(value);
  return source !== null && source.id === commentId && source.deleted === true;
}
