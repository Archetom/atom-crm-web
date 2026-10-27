import { recordOf } from "~/shared/utils/decode";

export interface NotificationPreference {
  emailEnabled: boolean;
  oaAnnouncementEmailEnabled: boolean;
}

/** Drops delivery addresses, provider state, readiness, and update timestamps. */
export function toNotificationPreference(value: unknown): NotificationPreference | null {
  const source = recordOf(value);
  if (
    source === null ||
    typeof source.emailEnabled !== "boolean" ||
    typeof source.oaAnnouncementEmailEnabled !== "boolean"
  ) {
    return null;
  }

  return {
    emailEnabled: source.emailEnabled,
    oaAnnouncementEmailEnabled: source.oaAnnouncementEmailEnabled,
  };
}
