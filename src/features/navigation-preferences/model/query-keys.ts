export const navigationPreferenceKeys = {
  all: ["navigation-preferences"] as const,
  current: (identityKey: string) =>
    [...navigationPreferenceKeys.all, "current", identityKey] as const,
};
