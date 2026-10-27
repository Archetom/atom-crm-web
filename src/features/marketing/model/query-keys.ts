export const marketingKeys = {
  all: ["marketing"] as const,
  forms: (identityKey: string, page: number, size: number) =>
    [...marketingKeys.all, "forms", identityKey, page, size] as const,
  form: (identityKey: string, formId: number) =>
    [...marketingKeys.all, "form", identityKey, formId] as const,
  configuration: (identityKey: string, formId?: number, targetObjectType?: "CUSTOMER" | "LEAD") =>
    [
      ...marketingKeys.all,
      "configuration",
      identityKey,
      formId ?? "new",
      targetObjectType ?? "persisted-target",
    ] as const,
  trend: (identityKey: string, formId: number, from: string, to: string) =>
    [...marketingKeys.all, "trend", identityKey, formId, from, to] as const,
  submissions: (identityKey: string, formId: number, page: number, size: number) =>
    [...marketingKeys.all, "submissions", identityKey, formId, page, size] as const,
  publicForm: (publicId: string) => [...marketingKeys.all, "public", publicId] as const,
};
