export const bootstrapKeys = {
  all: ["bootstrap"] as const,
  authorization: (identityKey: string) =>
    [...bootstrapKeys.all, "authorization", identityKey] as const,
  navigation: (identityKey: string) => [...bootstrapKeys.all, "navigation", identityKey] as const,
};
