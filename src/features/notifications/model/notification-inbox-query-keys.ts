export const notificationInboxKeys = {
  all: ["notification-inbox"] as const,
  list: (
    identityKey: string,
    params: { readonly page: number; readonly size: number; readonly unreadOnly: boolean },
  ) => ["notification-inbox", identityKey, params] as const,
};
