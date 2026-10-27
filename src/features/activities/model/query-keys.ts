import type { ActivitySubjectType } from "./activity-timeline";

export const activityKeys = {
  all: ["activities"] as const,
  detail: (identityKey: string, activityId: number) =>
    ["activities", "detail", identityKey, activityId] as const,
  timeline: (identityKey: string, subjectType: ActivitySubjectType, subjectId: number) =>
    ["activities", "timeline", identityKey, subjectType, subjectId] as const,
};
