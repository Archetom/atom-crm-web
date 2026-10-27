import { recordOf } from "~/shared/utils/decode";

export const workTaskSeriesFrequencies = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export const workTaskSeriesStatuses = ["DRAFT", "ACTIVE", "PAUSED", "STOPPED", "ENDED"] as const;
export const workTaskSeriesWeekdays = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;
export const workTaskSeriesActions = ["UPDATE", "ACTIVATE", "PAUSE", "STOP"] as const;
export const workTaskSeriesActionBlockers = [
  "SCHEDULER_UNAVAILABLE",
  "PARTICIPANT_INELIGIBLE",
] as const;

export type WorkTaskSeriesFrequency = (typeof workTaskSeriesFrequencies)[number];
export type WorkTaskSeriesStatus = (typeof workTaskSeriesStatuses)[number];
export type WorkTaskSeriesWeekday = (typeof workTaskSeriesWeekdays)[number];
export type WorkTaskSeriesAction = (typeof workTaskSeriesActions)[number];

export interface WorkTaskSeriesRecurrence {
  frequency: WorkTaskSeriesFrequency;
  interval: number;
  weekdays: readonly WorkTaskSeriesWeekday[];
  monthDay: number | null;
  lastDayOfMonth: boolean;
  zoneId: string;
  startLocalDate: string;
  localTime: string;
  endLocalDate: string | null;
}

export interface WorkTaskSeriesListItem extends WorkTaskSeriesRecurrence {
  id: number;
  title: string;
  status: WorkTaskSeriesStatus;
  version: number;
  allowedActions: readonly WorkTaskSeriesAction[];
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nonemptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function isWorkTaskSeriesValue<T extends readonly string[]>(
  value: unknown,
  values: T,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function calendarDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

function localTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}):(\d{2})(?::00)?$/.exec(value);
  return match !== null && Number(match[1]) < 24 && Number(match[2]) < 60 ? value : null;
}

function zoneId(value: unknown): string | null {
  const text = nonemptyText(value);
  if (text === null) return null;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: text });
    return text;
  } catch {
    return null;
  }
}

function uniqueValues<T extends readonly string[]>(value: unknown, values: T): T[number][] | null {
  if (!Array.isArray(value) || value.some((item) => !isWorkTaskSeriesValue(item, values))) {
    return null;
  }
  const unique = [...new Set(value)];
  return unique.length === value.length ? unique : null;
}

function weekdays(value: unknown): WorkTaskSeriesWeekday[] | null {
  const selected = uniqueValues(value, workTaskSeriesWeekdays);
  return selected === null
    ? null
    : selected.sort(
        (first, second) =>
          workTaskSeriesWeekdays.indexOf(first) - workTaskSeriesWeekdays.indexOf(second),
      );
}

function validRule(
  frequency: WorkTaskSeriesFrequency,
  interval: number,
  selectedWeekdays: readonly WorkTaskSeriesWeekday[],
  monthDay: number | null,
  lastDayOfMonth: boolean,
): boolean {
  if (frequency === "DAILY") {
    return interval <= 365 && selectedWeekdays.length === 0 && monthDay === null && !lastDayOfMonth;
  }
  if (frequency === "WEEKLY") {
    return (
      interval <= 52 &&
      selectedWeekdays.length > 0 &&
      selectedWeekdays.length <= 7 &&
      monthDay === null &&
      !lastDayOfMonth
    );
  }
  return (
    interval <= 24 &&
    selectedWeekdays.length === 0 &&
    ((monthDay !== null && monthDay >= 1 && monthDay <= 31 && !lastDayOfMonth) ||
      (monthDay === null && lastDayOfMonth))
  );
}

/** Decodes only the exact, server-issued recurrence baseline shared by list and detail views. */
export function toWorkTaskSeriesRecurrence(value: unknown): WorkTaskSeriesRecurrence | null {
  const source = recordOf(value);
  if (source === null) return null;

  const frequency = isWorkTaskSeriesValue(source.frequency, workTaskSeriesFrequencies)
    ? source.frequency
    : null;
  const interval = source.interval;
  const selectedWeekdays = weekdays(source.weekdays);
  const monthDay =
    source.monthDay === undefined || source.monthDay === null ? null : source.monthDay;
  const lastDayOfMonth = source.lastDayOfMonth;
  const recurrenceZoneId = zoneId(source.zoneId);
  const startLocalDate = calendarDate(source.startLocalDate);
  const localScheduleTime = localTime(source.localTime);
  const endLocalDate =
    source.endLocalDate === undefined || source.endLocalDate === null
      ? null
      : calendarDate(source.endLocalDate);
  if (
    frequency === null ||
    typeof interval !== "number" ||
    !Number.isSafeInteger(interval) ||
    interval < 1 ||
    selectedWeekdays === null ||
    (monthDay !== null && (typeof monthDay !== "number" || !Number.isSafeInteger(monthDay))) ||
    typeof lastDayOfMonth !== "boolean" ||
    recurrenceZoneId === null ||
    startLocalDate === null ||
    localScheduleTime === null ||
    (((source.endLocalDate !== undefined && source.endLocalDate !== null) ||
      endLocalDate !== null) &&
      endLocalDate === null) ||
    (endLocalDate !== null && endLocalDate < startLocalDate) ||
    !validRule(frequency, interval, selectedWeekdays, monthDay, lastDayOfMonth)
  ) {
    return null;
  }

  return {
    endLocalDate,
    frequency,
    interval,
    lastDayOfMonth,
    localTime: localScheduleTime,
    monthDay,
    startLocalDate,
    weekdays: selectedWeekdays,
    zoneId: recurrenceZoneId,
  };
}

export function toWorkTaskSeriesActions(value: unknown): WorkTaskSeriesAction[] | null {
  return uniqueValues(value, workTaskSeriesActions);
}

function hasKnownActionBlockers(value: unknown): boolean {
  return uniqueValues(value, workTaskSeriesActionBlockers) !== null;
}

/** Discards participants, description, automation state, occurrence counters, blockers, and timestamps. */
export function toWorkTaskSeriesListItem(value: unknown): WorkTaskSeriesListItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const title = nonemptyText(source.title);
  const recurrence = toWorkTaskSeriesRecurrence(source.recurrence);
  const status = isWorkTaskSeriesValue(source.status, workTaskSeriesStatuses)
    ? source.status
    : null;
  const version = source.version;
  const allowedActions = toWorkTaskSeriesActions(source.allowedActions);
  if (
    id === null ||
    title === null ||
    recurrence === null ||
    status === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    allowedActions === null ||
    !hasKnownActionBlockers(source.actionBlockers)
  ) {
    return null;
  }

  return { ...recurrence, allowedActions, id, status, title, version };
}

const weekdayLabels: Readonly<Record<WorkTaskSeriesWeekday, string>> = {
  FRIDAY: "周五",
  MONDAY: "周一",
  SATURDAY: "周六",
  SUNDAY: "周日",
  THURSDAY: "周四",
  TUESDAY: "周二",
  WEDNESDAY: "周三",
};

export function formatWorkTaskSeriesRule(series: WorkTaskSeriesRecurrence): string {
  const interval = series.interval === 1 ? "每" : `每 ${series.interval}`;
  const cadence =
    series.frequency === "DAILY"
      ? "天"
      : series.frequency === "WEEKLY"
        ? `周（${series.weekdays.map((weekday) => weekdayLabels[weekday]).join("、")}）`
        : series.lastDayOfMonth
          ? "月（最后一天）"
          : `月（${series.monthDay} 日）`;
  return `${interval}${cadence} · ${series.zoneId} · ${series.startLocalDate} ${series.localTime}`;
}
