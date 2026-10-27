export const oaKeys = {
  all: ["oa"] as const,
  forms: (identityKey: string, page: number, size: number) =>
    [...oaKeys.all, "forms", identityKey, page, size] as const,
  form: (identityKey: string, formId: number) =>
    [...oaKeys.all, "form", identityKey, formId] as const,
  formConfiguration: (identityKey: string) =>
    [...oaKeys.all, "form-configuration", identityKey] as const,
  requests: (identityKey: string, page: number, size: number) =>
    [...oaKeys.all, "requests", identityKey, page, size] as const,
  availableForms: (identityKey: string) => [...oaKeys.all, "available-forms", identityKey] as const,
  availableForm: (identityKey: string, formId: number) =>
    [...oaKeys.all, "available-form", identityKey, formId] as const,
  formFieldCandidates: (identityKey: string, formId: number, fieldCode: string, keyword: string) =>
    [...oaKeys.all, "form-field-candidates", identityKey, formId, fieldCode, keyword] as const,
  approvalSelectionCandidates: (
    identityKey: string,
    formId: number,
    selectionCode: string,
    keyword: string,
  ) =>
    [
      ...oaKeys.all,
      "approval-selection-candidates",
      identityKey,
      formId,
      selectionCode,
      keyword,
    ] as const,
  announcements: (identityKey: string, page: number, size: number) =>
    [...oaKeys.all, "announcements", identityKey, page, size] as const,
  announcement: (identityKey: string, announcementId: number) =>
    [...oaKeys.all, "announcement", identityKey, announcementId] as const,
  announcementAudienceCandidates: (
    identityKey: string,
    type: "MEMBER" | "DEPARTMENT_SUBTREE",
    keyword: string,
  ) => [...oaKeys.all, "announcement-audience-candidates", identityKey, type, keyword] as const,
  inbox: (identityKey: string, page: number, size: number) =>
    [...oaKeys.all, "inbox", identityKey, page, size] as const,
  inboxAnnouncement: (identityKey: string, announcementId: number) =>
    [...oaKeys.all, "inbox-announcement", identityKey, announcementId] as const,
  inboxUnreadCount: (identityKey: string) =>
    [...oaKeys.all, "inbox-unread-count", identityKey] as const,
};
