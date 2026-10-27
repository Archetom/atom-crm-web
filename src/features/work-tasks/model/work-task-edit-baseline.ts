import { isWorkTaskPriority, type WorkTaskPriority } from "./work-task-priority";
import { recordOf } from "~/shared/utils/decode";

export type { WorkTaskPriority } from "./work-task-priority";

export interface WorkTaskEditBaseline {
  id: number;
  version: number;
  title: string;
  description: string;
  priority: WorkTaskPriority;
  dueTime: string | null;
  status: "TODO" | "IN_PROGRESS";
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function isOpenStatus(value: unknown): value is WorkTaskEditBaseline["status"] {
  return value === "TODO" || value === "IN_PROGRESS";
}

/** Retains the complete versioned baseline required only for a manager's structure editor. */
export function toWorkTaskEditBaseline(value: unknown): WorkTaskEditBaseline | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const version = source.version;
  if (
    id === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    typeof source.title !== "string" ||
    source.title.trim().length === 0 ||
    (source.description !== null && typeof source.description !== "string") ||
    !isWorkTaskPriority(source.priority) ||
    (source.dueTime !== null && typeof source.dueTime !== "string") ||
    !isOpenStatus(source.status)
  ) {
    return null;
  }

  return {
    id,
    version,
    title: source.title,
    description: source.description ?? "",
    priority: source.priority,
    dueTime: source.dueTime,
    status: source.status,
  };
}
