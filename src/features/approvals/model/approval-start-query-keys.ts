export const approvalStartKeys = {
  all: ["approval-start"] as const,
  candidates: (
    identityKey: string,
    objectType: string,
    subjectId: number,
    definitionId: number,
    selectionCode: string,
    page: number,
    size: number,
  ) =>
    [
      "approval-start",
      identityKey,
      "candidates",
      objectType,
      subjectId,
      definitionId,
      selectionCode,
      page,
      size,
    ] as const,
  options: (identityKey: string, objectType: string, subjectId: number) =>
    ["approval-start", identityKey, "options", objectType, subjectId] as const,
};
