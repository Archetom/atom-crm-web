import type { components } from "~/api/generated/schema";

import {
  workTaskSeriesFrequencies,
  workTaskSeriesWeekdays,
  type WorkTaskSeriesFrequency,
  type WorkTaskSeriesWeekday,
} from "./work-task-series-list-item";
import { workTaskSeriesPriorities, type WorkTaskSeriesPriority } from "./work-task-series-detail";

export interface WorkTaskSeriesCreateValues {
  title: string;
  assigneeActorId: number;
  description?: string;
  priority?: WorkTaskSeriesPriority;
  followerActorIds?: readonly number[];
  frequency: WorkTaskSeriesFrequency;
  interval: number;
  weekdays: readonly WorkTaskSeriesWeekday[];
  monthDay?: number;
  lastDayOfMonth: boolean;
  zoneId: string;
  startLocalDate: string;
  localTime: string;
  endLocalDate?: string;
}

export interface WorkTaskSeriesUpdateValues extends WorkTaskSeriesCreateValues {
  description: string;
  priority: WorkTaskSeriesPriority;
  followerActorIds: readonly number[];
  version: number;
}

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeLocalTime(value: string): string | null {
  const match = /^(\d{2}):(\d{2})(?::00)?$/.exec(value);
  return match !== null && Number(match[1]) < 24 && Number(match[2]) < 60
    ? `${match[1]}:${match[2]}:00`
    : null;
}

function validZoneId(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function validRule(values: WorkTaskSeriesCreateValues): boolean {
  if (values.frequency === "DAILY") {
    return (
      values.interval <= 365 &&
      values.weekdays.length === 0 &&
      values.monthDay === undefined &&
      !values.lastDayOfMonth
    );
  }
  if (values.frequency === "WEEKLY") {
    return (
      values.interval <= 52 &&
      values.weekdays.length >= 1 &&
      values.weekdays.length <= 7 &&
      values.monthDay === undefined &&
      !values.lastDayOfMonth
    );
  }
  return (
    values.interval <= 24 &&
    values.weekdays.length === 0 &&
    ((values.monthDay !== undefined &&
      Number.isSafeInteger(values.monthDay) &&
      values.monthDay >= 1 &&
      values.monthDay <= 31 &&
      !values.lastDayOfMonth) ||
      (values.monthDay === undefined && values.lastDayOfMonth))
  );
}

export function toWorkTaskSeriesCreateRequest(
  values: WorkTaskSeriesCreateValues,
): components["schemas"]["WorkTaskSeriesCreateRequest"] | null {
  const title = values.title.trim();
  const description = values.description?.trim();
  const zoneId = values.zoneId.trim();
  const requestedEndLocalDate = values.endLocalDate?.trim();
  const endLocalDate =
    requestedEndLocalDate === undefined || requestedEndLocalDate.length === 0
      ? undefined
      : requestedEndLocalDate;
  const localTime = normalizeLocalTime(values.localTime.trim());
  const followerActorIds = values.followerActorIds ?? [];
  const uniqueFollowerActorIds = [...new Set(followerActorIds)];
  const uniqueWeekdays = [...new Set(values.weekdays)];
  if (
    title.length === 0 ||
    title.length > 200 ||
    (description !== undefined && description.length > 10_000) ||
    (values.priority !== undefined && !workTaskSeriesPriorities.includes(values.priority)) ||
    !Number.isSafeInteger(values.assigneeActorId) ||
    values.assigneeActorId < 1 ||
    followerActorIds.length > 50 ||
    uniqueFollowerActorIds.length !== followerActorIds.length ||
    uniqueFollowerActorIds.some(
      (followerActorId) => !Number.isSafeInteger(followerActorId) || followerActorId < 1,
    ) ||
    !workTaskSeriesFrequencies.includes(values.frequency) ||
    !Number.isSafeInteger(values.interval) ||
    values.interval < 1 ||
    uniqueWeekdays.length !== values.weekdays.length ||
    uniqueWeekdays.some((weekday) => !workTaskSeriesWeekdays.includes(weekday)) ||
    !validZoneId(zoneId) ||
    !validCalendarDate(values.startLocalDate) ||
    localTime === null ||
    (endLocalDate !== undefined &&
      (!validCalendarDate(endLocalDate) || endLocalDate < values.startLocalDate)) ||
    !validRule({ ...values, weekdays: uniqueWeekdays })
  ) {
    return null;
  }

  return {
    assigneeActorId: values.assigneeActorId,
    ...(description === undefined || description.length === 0 ? {} : { description }),
    ...(endLocalDate === undefined ? {} : { endLocalDate }),
    ...(uniqueFollowerActorIds.length === 0 ? {} : { followerActorIds: uniqueFollowerActorIds }),
    ...(values.frequency === "MONTHLY" && values.lastDayOfMonth ? { lastDayOfMonth: true } : {}),
    ...(values.frequency === "MONTHLY" && values.monthDay !== undefined
      ? { monthDay: values.monthDay }
      : {}),
    ...(uniqueWeekdays.length === 0 ? {} : { weekdays: uniqueWeekdays }),
    localTime,
    recurrenceFrequency: values.frequency,
    recurrenceInterval: values.interval,
    startLocalDate: values.startLocalDate,
    ...(values.priority === undefined ? {} : { priority: values.priority }),
    title,
    zoneId,
  };
}

/** Builds a full replacement only from the server-issued detail baseline plus explicit edits. */
export function toWorkTaskSeriesUpdateRequest(
  values: WorkTaskSeriesUpdateValues,
): components["schemas"]["WorkTaskSeriesUpdateRequest"] | null {
  const base = toWorkTaskSeriesCreateRequest(values);
  const followers = [...new Set(values.followerActorIds)];
  if (
    base === null ||
    typeof values.description !== "string" ||
    !workTaskSeriesPriorities.includes(values.priority) ||
    !Number.isSafeInteger(values.version) ||
    values.version < 0 ||
    followers.length !== values.followerActorIds.length ||
    followers.length > 50 ||
    followers.some((actorId) => !Number.isSafeInteger(actorId) || actorId < 1)
  ) {
    return null;
  }

  return {
    ...base,
    description: values.description,
    followerActorIds: followers,
    priority: values.priority,
    version: values.version,
  };
}
