import type { components } from "~/api/generated/schema";

export const marketingActivityKeys = {
  all: ["marketing-activities"] as const,
  attachments: ["marketing-activities", "attachments"] as const,
  list: (identityKey: string, query: components["schemas"]["MarketingActivityQueryRequest"]) =>
    [...marketingActivityKeys.all, "list", identityKey, query] as const,
  detail: (identityKey: string, activityId: number) =>
    [...marketingActivityKeys.all, "detail", identityKey, activityId] as const,
  attachmentList: (identityKey: string, activityId: number, imageType: "COVER" | "DETAIL") =>
    [...marketingActivityKeys.attachments, identityKey, activityId, imageType] as const,
  members: (identityKey: string, keyword: string) =>
    [...marketingActivityKeys.all, "member-options", identityKey, keyword] as const,
  configuration: (identityKey: string) =>
    [...marketingActivityKeys.all, "configuration", identityKey] as const,
};
