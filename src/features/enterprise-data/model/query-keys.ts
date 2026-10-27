export const enterpriseDataKeys = {
  all: ["enterprise-data"] as const,
  capabilities: (identityKey: string) =>
    [...enterpriseDataKeys.all, "capabilities", identityKey] as const,
};
