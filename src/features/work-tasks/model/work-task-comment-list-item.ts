import { recordOf } from "~/shared/utils/decode";

export interface WorkTaskCommentListItem {
  id: number;
  taskId: number;
  version: number;
  content: string;
  createdTime: string | null;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Discards the comment author and update timestamp. */
export function toWorkTaskCommentListItem(value: unknown): WorkTaskCommentListItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const taskId = positiveIdentifier(source.taskId);
  const content = optionalText(source.content);
  const version = source.version;
  if (
    id === null ||
    taskId === null ||
    content === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    return null;
  }

  return { id, taskId, version, content, createdTime: optionalText(source.createdTime) };
}
