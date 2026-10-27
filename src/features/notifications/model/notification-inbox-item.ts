import { recordOf } from "~/shared/utils/decode";

export const notificationInboxKinds = ["WORK_TASK_REMINDER", "WORK_TASK_ESCALATION"] as const;
export const notificationInboxPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const notificationInboxStatuses = ["UNREAD", "READ"] as const;

export type NotificationInboxKind = (typeof notificationInboxKinds)[number];
export type NotificationInboxPriority = (typeof notificationInboxPriorities)[number];
export type NotificationInboxStatus = (typeof notificationInboxStatuses)[number];

export interface NotificationInboxItem {
  dueTime: string;
  id: number;
  kind: NotificationInboxKind;
  priority: NotificationInboxPriority;
  status: NotificationInboxStatus;
  title: string;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
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

/** Drops task identity, recipient identity, reminder/delivery projection, and lifecycle timestamps. */
export function toNotificationInboxItem(value: unknown): NotificationInboxItem | null {
  const source = recordOf(value);
  const id = source === null ? null : positiveIdentifier(source.id);
  const dueTime = source === null ? null : localDateTime(source.dueTime);
  if (
    source === null ||
    id === null ||
    dueTime === null ||
    typeof source.title !== "string" ||
    source.title.length === 0 ||
    !isOneOf(source.kind, notificationInboxKinds) ||
    !isOneOf(source.priority, notificationInboxPriorities) ||
    !isOneOf(source.status, notificationInboxStatuses)
  ) {
    return null;
  }

  return {
    dueTime,
    id,
    kind: source.kind,
    priority: source.priority,
    status: source.status,
    title: source.title,
  };
}
