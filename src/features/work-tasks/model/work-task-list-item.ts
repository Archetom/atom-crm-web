import { toWorkTaskBusinessRecord, type WorkTaskBusinessRecord } from "./work-task-business-record";
import { recordOf } from "~/shared/utils/decode";

export interface WorkTaskListItem {
  businessRecord: WorkTaskBusinessRecord | null;
  id: number;
  version: number;
  title: string;
  priority: string | null;
  dueTime: string | null;
  overdue: boolean;
  status: string | null;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Discards task description, participants, origin, and lifecycle history. */
export function toWorkTaskListItem(value: unknown): WorkTaskListItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const title = optionalText(source.title);
  const version = source.version;
  if (
    id === null ||
    title === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    typeof source.overdue !== "boolean"
  ) {
    return null;
  }

  const businessRecord = toWorkTaskBusinessRecord(
    source.businessObjectType,
    source.businessRecordId,
  );
  return {
    businessRecord: businessRecord ?? null,
    id,
    version,
    title,
    priority: optionalText(source.priority),
    dueTime: optionalText(source.dueTime),
    overdue: source.overdue,
    status: optionalText(source.status),
  };
}
