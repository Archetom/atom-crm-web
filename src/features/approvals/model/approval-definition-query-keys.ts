export const approvalDefinitionKeys = {
  all: ["approval-definitions"] as const,
  list: (identityKey: string, params: { readonly page: number; readonly size: number }) =>
    ["approval-definitions", identityKey, params] as const,
  edit: (identityKey: string, definitionId: number) =>
    ["approval-definitions", identityKey, "edit", definitionId] as const,
  status: (identityKey: string, definitionId: number) =>
    ["approval-definitions", identityKey, "status", definitionId] as const,
};
