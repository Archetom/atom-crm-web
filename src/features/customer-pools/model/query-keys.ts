export const customerPoolKeys = {
  all: ["customer-pools"] as const,
  catalog: (identityKey: string) => ["customer-pools", "catalog", identityKey] as const,
  configurations: (identityKey: string, query: { page: number; size: number }) =>
    ["customer-pools", "configurations", identityKey, query] as const,
  customers: (
    identityKey: string,
    poolId: number,
    query: { name?: string; page: number; size: number },
  ) => ["customer-pools", "customers", identityKey, poolId, query] as const,
};
