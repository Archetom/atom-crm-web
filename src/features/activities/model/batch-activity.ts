import type { components } from "~/api/generated/schema";

import type { ActivitySubjectType } from "./activity-timeline";

export interface BatchActivityDraft {
  category: string;
  content: string;
  occurredTime: string;
  purpose: string;
}

/**
 * Produces one generated activity-write contract per selected record. The
 * caller deliberately supplies only same-type visible list records; tenant,
 * actor, scope, and relationships stay server-controlled.
 */
export function toBatchActivityCreateRequests(
  subjectIds: readonly number[],
  subjectType: ActivitySubjectType,
  draft: BatchActivityDraft,
): components["schemas"]["ActivityCreateRequest"][] | null {
  const category = draft.category.trim();
  const content = draft.content.trim();
  const occurredTime = draft.occurredTime.trim();
  if (category.length === 0 || content.length === 0 || occurredTime.length === 0) return null;

  const uniqueIds = new Set<number>();
  for (const subjectId of subjectIds) {
    if (!Number.isSafeInteger(subjectId) || subjectId <= 0) return null;
    uniqueIds.add(subjectId);
  }
  if (uniqueIds.size === 0 || uniqueIds.size > 100) return null;

  const purpose = draft.purpose.trim();
  return [...uniqueIds].map((subjectId) => ({
    category,
    content,
    occurredTime,
    ...(purpose.length === 0 ? {} : { purpose }),
    subjectId,
    subjectType,
  }));
}
