import { recordOf } from "~/shared/utils/decode";

export const worklistKinds = [
  "FOLLOW_UP",
  "RETURN_VISIT",
  "CONTACT_FOLLOW_UP",
  "LEAD_FOLLOW_UP",
  "OPPORTUNITY_FOLLOW_UP",
  "RECEIVABLE_PLAN_REMINDER",
  "CONTRACT_EXPIRY",
  "APPROVAL_PENDING",
  "WORK_TASK",
] as const;

export type WorklistKind = (typeof worklistKinds)[number];

export interface WorklistItem {
  kind: WorklistKind;
  sourceId: number;
  sourceVersion: number;
  subjectId: number;
  subjectType: string;
  dueTime: string;
  summary: string;
}

export interface WorklistPage {
  items: readonly WorklistItem[];
  nextCursor: string | null;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nonNegativeVersion(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function nonEmptyText(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength ? value : null;
}

function isWorklistKind(value: unknown): value is WorklistKind {
  return typeof value === "string" && worklistKinds.includes(value as WorklistKind);
}

function toWorklistItem(value: unknown): WorklistItem | null {
  const source = recordOf(value);
  if (source === null || !isWorklistKind(source.kind)) return null;

  const sourceId = positiveIdentifier(source.sourceId);
  const sourceVersion = nonNegativeVersion(source.sourceVersion);
  const subjectId = positiveIdentifier(source.subjectId);
  const subjectType = nonEmptyText(source.subjectType, 40);
  const dueTime = nonEmptyText(source.dueTime, 64);
  const summary = nonEmptyText(source.summary, 500);
  if (
    sourceId === null ||
    sourceVersion === null ||
    subjectId === null ||
    subjectType === null ||
    dueTime === null ||
    Number.isNaN(Date.parse(dueTime)) ||
    summary === null
  ) {
    return null;
  }

  return { kind: source.kind, sourceId, sourceVersion, subjectId, subjectType, dueTime, summary };
}

/**
 * Keeps only the server-confirmed acknowledgement fingerprint and the narrow
 * summary necessary to render a caller-scoped daily worklist. Cursors remain
 * query-cache state and are never exposed through URLs or persistent storage.
 */
export function toWorklistPage(value: unknown): WorklistPage | null {
  const source = recordOf(value);
  if (source === null || !Array.isArray(source.items)) return null;

  const items = source.items.map(toWorklistItem);
  if (items.some((item) => item === null)) return null;

  if (source.nextCursor === null) {
    return {
      items: items.filter((item): item is WorklistItem => item !== null),
      nextCursor: null,
    };
  }

  const nextCursor = nonEmptyText(source.nextCursor, 2048);
  if (nextCursor === null) return null;

  return {
    items: items.filter((item): item is WorklistItem => item !== null),
    nextCursor,
  };
}
