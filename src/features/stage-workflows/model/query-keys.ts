export const stageWorkflowKeys = {
  all: ["stage-workflows"] as const,
  detail: (identityKey: string, workflowId: number) =>
    ["stage-workflows", identityKey, "detail", workflowId] as const,
  editable: (identityKey: string, workflowId: number) =>
    ["stage-workflows", identityKey, "editable", workflowId] as const,
  configurationOptions: (identityKey: string, objectType: string | null) =>
    ["stage-workflows", identityKey, "configuration-options", objectType] as const,
  configurationCandidates: (
    identityKey: string,
    candidateType: "MEMBER" | "DEPARTMENT",
    keyword: string,
  ) =>
    ["stage-workflows", identityKey, "configuration-candidates", candidateType, keyword] as const,
  list: (identityKey: string, params: { readonly page: number; readonly size: number }) =>
    ["stage-workflows", identityKey, params] as const,
};
