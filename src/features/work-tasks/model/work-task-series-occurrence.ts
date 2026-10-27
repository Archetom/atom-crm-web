import { recordOf } from "~/shared/utils/decode";

export const workTaskSeriesOccurrenceStatuses = ["MATERIALIZED", "SKIPPED"] as const;
export type WorkTaskSeriesOccurrenceStatus = (typeof workTaskSeriesOccurrenceStatuses)[number];

export interface WorkTaskSeriesOccurrence {
  occurrenceSequence: number;
  resolvedDueTime: string;
  status: WorkTaskSeriesOccurrenceStatus;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function localDateTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?$/.exec(value);
  if (match === null) return null;

  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day &&
    parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute &&
    parsed.getUTCSeconds() === second
    ? value
    : null;
}

function isStatus(value: unknown): value is WorkTaskSeriesOccurrenceStatus {
  return (
    typeof value === "string" && workTaskSeriesOccurrenceStatuses.some((status) => status === value)
  );
}

/**
 * Retains occurrence facts needed for a read-only timeline and deliberately
 * discards occurrence IDs, generated task IDs, generation, schedule metadata,
 * safe reasons, and timestamps.
 */
export function toWorkTaskSeriesOccurrence(
  value: unknown,
  expectedSeriesId: number,
): WorkTaskSeriesOccurrence | null {
  const source = recordOf(value);
  if (source === null || positiveIdentifier(source.seriesId) !== expectedSeriesId) return null;

  const occurrenceSequence = positiveIdentifier(source.occurrenceSequence);
  const resolvedDueTime = localDateTime(source.resolvedDueTime);
  if (occurrenceSequence === null || resolvedDueTime === null || !isStatus(source.status)) {
    return null;
  }
  return { occurrenceSequence, resolvedDueTime, status: source.status };
}
