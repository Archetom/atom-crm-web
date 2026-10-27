export const embeddedPageKeys = {
  all: ["embedded-pages"] as const,
  configuration: (identityKey: string) =>
    [...embeddedPageKeys.all, "configuration", identityKey] as const,
  list: (
    identityKey: string,
    query: {
      objectType?: string;
      page?: number;
      platform?: string;
      size?: number;
      status?: string;
    },
  ) =>
    [
      ...embeddedPageKeys.all,
      "list",
      identityKey,
      query.page,
      query.size,
      query.objectType,
      query.platform,
      query.status,
    ] as const,
  rendered: (identityKey: string, objectType: string, recordId: number, platform: string) =>
    [...embeddedPageKeys.all, "rendered", identityKey, objectType, recordId, platform] as const,
};
