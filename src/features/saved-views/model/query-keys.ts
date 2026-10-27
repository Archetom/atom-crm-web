export const savedViewKeys = {
  all: ["saved-views"] as const,
  list: (identityKey: string, objectType: string, includeHidden: boolean) =>
    [...savedViewKeys.all, "list", identityKey, objectType, includeHidden] as const,
  fields: (identityKey: string, objectType: string) =>
    [...savedViewKeys.all, "fields", identityKey, objectType] as const,
};
