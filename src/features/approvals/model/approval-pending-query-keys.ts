export const approvalPendingKeys = {
  all: ["approval-pending"] as const,
  count: (identityKey: string) => ["approval-pending", identityKey, "count"] as const,
  detail: (identityKey: string, instanceId: number) =>
    ["approval-pending", identityKey, "detail", instanceId] as const,
  list: (identityKey: string, params: { readonly page: number; readonly size: number }) =>
    ["approval-pending", identityKey, params] as const,
  transferCandidates: (
    identityKey: string,
    instanceId: number,
    params: { readonly page: number; readonly size: number },
  ) => ["approval-pending", identityKey, "transfer-candidates", instanceId, params] as const,
};
