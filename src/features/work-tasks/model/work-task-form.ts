import type { components } from "~/api/generated/schema";

import {
  toWorkTaskBusinessRecord,
  type WorkTaskBusinessRecordType,
} from "./work-task-business-record";
import { isWorkTaskPriority, type WorkTaskPriority } from "./work-task-priority";

export interface WorkTaskCreateValues {
  title: string;
  assigneeActorId: number;
  description?: string;
  priority?: WorkTaskPriority;
  dueTime?: string;
  followerActorIds?: readonly number[];
  businessObjectType?: WorkTaskBusinessRecordType;
  businessRecordId?: number;
}

export function toWorkTaskCreateRequest(
  values: WorkTaskCreateValues,
): components["schemas"]["WorkTaskCreateRequest"] | null {
  const title = values.title.trim();
  if (
    title.length === 0 ||
    title.length > 200 ||
    !Number.isSafeInteger(values.assigneeActorId) ||
    values.assigneeActorId <= 0
  ) {
    return null;
  }
  const description = values.description?.trim();
  const dueTime = values.dueTime?.trim();
  const followerActorIds = values.followerActorIds ?? [];
  const uniqueFollowerActorIds = [...new Set(followerActorIds)];
  const businessRecord = toWorkTaskBusinessRecord(
    values.businessObjectType,
    values.businessRecordId,
  );
  if (
    (description !== undefined && description.length > 10_000) ||
    (values.priority !== undefined && !isWorkTaskPriority(values.priority)) ||
    followerActorIds.length > 50 ||
    uniqueFollowerActorIds.length !== followerActorIds.length ||
    uniqueFollowerActorIds.some(
      (followerActorId) => !Number.isSafeInteger(followerActorId) || followerActorId <= 0,
    ) ||
    businessRecord === undefined
  ) {
    return null;
  }

  return {
    assigneeActorId: values.assigneeActorId,
    ...(description === undefined || description.length === 0 ? {} : { description }),
    ...(dueTime === undefined || dueTime.length === 0 ? {} : { dueTime }),
    ...(uniqueFollowerActorIds.length === 0 ? {} : { followerActorIds: uniqueFollowerActorIds }),
    ...(values.priority === undefined ? {} : { priority: values.priority }),
    ...(businessRecord === null
      ? {}
      : {
          businessObjectType: businessRecord.objectType,
          businessRecordId: businessRecord.recordId,
        }),
    title,
  };
}
