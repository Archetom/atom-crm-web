import { describe, expect, it } from "vitest";

import { toNotificationPreference } from "./notification-preference";

describe("toNotificationPreference", () => {
  it("keeps only the current member's two channel choices", () => {
    expect(
      toNotificationPreference({
        deliveryProvider: "mail-provider",
        emailAddress: "member@example.test",
        emailEnabled: true,
        oaAnnouncementEmailEnabled: false,
        readiness: "READY",
        updatedTime: "2026-07-26T12:00:00",
      }),
    ).toEqual({ emailEnabled: true, oaAnnouncementEmailEnabled: false });
  });

  it("fails closed for incomplete channel preferences", () => {
    expect(toNotificationPreference({ emailEnabled: true })).toBeNull();
    expect(
      toNotificationPreference({ emailEnabled: "true", oaAnnouncementEmailEnabled: false }),
    ).toBeNull();
  });
});
