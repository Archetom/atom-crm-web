export const leadIntakeClientKeys = {
  all: ["lead-intake-clients"] as const,
  list: (identityKey: string) => [...leadIntakeClientKeys.all, "list", identityKey] as const,
};
