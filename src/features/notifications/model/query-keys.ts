export const notificationPreferenceKeys = {
  all: ["notification-preferences"] as const,
  current: (identityKey: string) => ["notification-preferences", identityKey] as const,
};
