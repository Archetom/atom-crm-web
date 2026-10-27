export const stageWorkflowRuntimeKeys = {
  all: ["stage-workflow-runtime"] as const,
  applicable: (identityKey: string, objectType: string, recordId: number) =>
    ["stage-workflow-runtime", identityKey, "applicable", objectType, recordId] as const,
  detail: (identityKey: string, workflowRecordId: number) =>
    ["stage-workflow-runtime", identityKey, "detail", workflowRecordId] as const,
  comments: (identityKey: string, workflowRecordId: number) =>
    ["stage-workflow-runtime", identityKey, "comments", workflowRecordId] as const,
  commentList: (
    identityKey: string,
    workflowRecordId: number,
    query: { page: number; size: number },
  ) => ["stage-workflow-runtime", identityKey, "comments", workflowRecordId, query] as const,
  advanceCandidatePage: (
    identityKey: string,
    workflowRecordId: number,
    version: number,
    selectionCode: string,
    page: number,
    size: number,
  ) =>
    [
      "stage-workflow-runtime",
      identityKey,
      "advance-candidates",
      workflowRecordId,
      version,
      selectionCode,
      page,
      size,
    ] as const,
  fieldCandidatePage: (
    identityKey: string,
    workflowRecordId: number,
    version: number,
    fieldCode: string,
    page: number,
    size: number,
  ) =>
    [
      "stage-workflow-runtime",
      identityKey,
      "field-candidates",
      workflowRecordId,
      version,
      fieldCode,
      page,
      size,
    ] as const,
};
