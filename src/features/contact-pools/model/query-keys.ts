export const contactPoolKeys = {
  all: ["contact-pools"] as const,
  catalog: (identityKey: string) => ["contact-pools", "catalog", identityKey] as const,
  configurations: (identityKey: string, query: { page: number; size: number }) =>
    ["contact-pools", "configurations", identityKey, query] as const,
  contacts: (
    identityKey: string,
    poolId: number,
    query: { name?: string; page: number; size: number },
  ) => ["contact-pools", "contacts", identityKey, poolId, query] as const,
};
