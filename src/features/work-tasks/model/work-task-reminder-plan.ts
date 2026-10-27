import { recordOf } from "~/shared/utils/decode";

export const workTaskReminderTimings = ["BEFORE_DUE", "AT_DUE", "OVERDUE"] as const;
export type WorkTaskReminderTiming = (typeof workTaskReminderTimings)[number];

export const workTaskReminderRecipients = ["ASSIGNEE", "CREATOR", "FOLLOWERS"] as const;
export type WorkTaskReminderRecipient = (typeof workTaskReminderRecipients)[number];

export interface WorkTaskReminderStep {
  timing: WorkTaskReminderTiming;
  offsetMinutes: number;
  recipientRoles: readonly WorkTaskReminderRecipient[];
}

export interface WorkTaskReminderPlanBaseline {
  version: number;
  steps: readonly WorkTaskReminderStep[];
}

export interface WorkTaskReminderPlan extends WorkTaskReminderPlanBaseline {
  taskId: number;
}

export interface WorkTaskSeriesReminderPlan extends WorkTaskReminderPlanBaseline {
  seriesId: number;
}

export const maximumWorkTaskReminderSteps = 8;
export const maximumWorkTaskReminderOffsetMinutes = 30 * 24 * 60;

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function isWorkTaskReminderTiming(value: unknown): value is WorkTaskReminderTiming {
  return workTaskReminderTimings.some((timing) => timing === value);
}

export function isWorkTaskReminderRecipient(value: unknown): value is WorkTaskReminderRecipient {
  return workTaskReminderRecipients.some((recipient) => recipient === value);
}

function isOffsetValid(timing: WorkTaskReminderTiming, offsetMinutes: number): boolean {
  return timing === "AT_DUE"
    ? offsetMinutes === 0
    : offsetMinutes >= 1 && offsetMinutes <= maximumWorkTaskReminderOffsetMinutes;
}

/** Validates only the fixed request shape; the server remains the source of reminder semantics. */
export function isWorkTaskReminderStep(value: unknown): value is WorkTaskReminderStep {
  const source = recordOf(value);
  if (source === null || !Array.isArray(source.recipientRoles)) return false;

  const recipientRoles = source.recipientRoles;
  return (
    isWorkTaskReminderTiming(source.timing) &&
    typeof source.offsetMinutes === "number" &&
    Number.isSafeInteger(source.offsetMinutes) &&
    isOffsetValid(source.timing, source.offsetMinutes) &&
    recipientRoles.length >= 1 &&
    recipientRoles.length <= 3 &&
    recipientRoles.every(isWorkTaskReminderRecipient) &&
    new Set(recipientRoles).size === recipientRoles.length
  );
}

function stepKey(step: WorkTaskReminderStep): string {
  return `${step.timing}:${step.offsetMinutes}:${[...step.recipientRoles].sort().join(",")}`;
}

/** Keeps browser drafts within the server's fixed plan bounds before a write can be enabled. */
export function hasValidWorkTaskReminderSteps(
  steps: readonly unknown[],
): steps is readonly WorkTaskReminderStep[] {
  if (steps.length > maximumWorkTaskReminderSteps) return false;

  const validSteps: WorkTaskReminderStep[] = [];
  for (const step of steps) {
    if (!isWorkTaskReminderStep(step)) return false;
    validSteps.push(step);
  }
  return new Set(validSteps.map(stepKey)).size === validSteps.length;
}

/**
 * Retains the complete, versioned task reminder plan and deliberately discards step keys,
 * notification projection state, and every task-detail field.
 */
export function toWorkTaskReminderPlan(value: unknown): WorkTaskReminderPlan | null {
  const source = recordOf(value);
  if (source === null || !Array.isArray(source.steps) || source.seriesId != null) return null;

  const taskId = positiveIdentifier(source.taskId);
  const version = source.version;
  if (
    taskId === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    !hasValidWorkTaskReminderSteps(source.steps)
  ) {
    return null;
  }

  const steps = source.steps.map((step) => ({
    timing: step.timing,
    offsetMinutes: step.offsetMinutes,
    recipientRoles: [...step.recipientRoles].sort(),
  }));
  return { taskId, version, steps };
}

/**
 * Retains the complete, versioned future-series reminder template and deliberately
 * discards step keys, task notification projection state, and every series detail field.
 */
export function toWorkTaskSeriesReminderPlan(value: unknown): WorkTaskSeriesReminderPlan | null {
  const source = recordOf(value);
  if (source === null || !Array.isArray(source.steps) || source.taskId != null) return null;

  const seriesId = positiveIdentifier(source.seriesId);
  const version = source.version;
  if (
    seriesId === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    !hasValidWorkTaskReminderSteps(source.steps)
  ) {
    return null;
  }

  const steps = source.steps.map((step) => ({
    timing: step.timing,
    offsetMinutes: step.offsetMinutes,
    recipientRoles: [...step.recipientRoles].sort(),
  }));
  return { seriesId, version, steps };
}
