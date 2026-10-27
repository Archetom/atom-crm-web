import type { components } from "~/api/generated/schema";

import { isWorkTaskPriority, type WorkTaskPriority } from "./work-task-priority";

export interface WorkTaskEditValues {
  title: string;
  description: string;
  priority: WorkTaskPriority;
  dueTime?: string;
  version: number;
}

export function toWorkTaskUpdateRequest(
  values: WorkTaskEditValues,
): components["schemas"]["WorkTaskUpdateRequest"] | null {
  const title = values.title.trim();
  const dueTime = values.dueTime?.trim();
  if (
    title.length === 0 ||
    title.length > 200 ||
    values.description.length > 10_000 ||
    !isWorkTaskPriority(values.priority) ||
    !Number.isSafeInteger(values.version) ||
    values.version < 0
  ) {
    return null;
  }

  return {
    description: values.description,
    ...(dueTime === undefined || dueTime.length === 0 ? {} : { dueTime }),
    priority: values.priority,
    title,
    version: values.version,
  };
}
