import { recordOf } from "~/shared/utils/decode";

export const activitySubjectTypes = [
  "CUSTOMER",
  "CONTACT",
  "LEAD",
  "OPPORTUNITY",
  "CONTRACT",
  "INVOICE",
  "RECEIVABLE",
  "RECEIVABLE_PLAN",
] as const;

export type ActivitySubjectType = (typeof activitySubjectTypes)[number];

export interface ActivityTimelineItem {
  id: number;
  kind: string | null;
  category: string | null;
  content: string;
  nextContactTime: string | null;
  occurredTime: string;
  purpose: string | null;
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

/**
 * Keep a timeline projection narrow: related business records, attachments,
 * dynamic fields, author identity, and optimistic-lock state stay out of the
 * client until their own read and action boundaries are implemented.
 */
export function toActivityTimelineItem(value: unknown): ActivityTimelineItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const content = requiredText(source.content);
  const occurredTime = requiredText(source.occurredTime);
  if (id === null || content === null || occurredTime === null) return null;

  return {
    id,
    kind: optionalText(source.kind),
    category: optionalText(source.category),
    content,
    nextContactTime: optionalText(source.nextContactTime),
    occurredTime,
    purpose: optionalText(source.purpose),
  };
}
