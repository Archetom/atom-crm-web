export const organizationKeys = {
  all: ["organization"] as const,
  accessibleTenants: (identityKey: string) =>
    ["organization", "accessible-tenants", identityKey] as const,
  departments: (identityKey: string) => ["organization", "departments", identityKey] as const,
  memberLists: (identityKey: string) => ["organization", "members", identityKey] as const,
  members: (identityKey: string, request: { keyword?: string; page: number; size: number }) =>
    ["organization", "members", identityKey, request] as const,
  departmentMembers: (
    identityKey: string,
    departmentId: number,
    request: { includeDescendants?: boolean; keyword?: string; page: number; size: number },
  ) => ["organization", "department-members", identityKey, departmentId, request] as const,
  membershipRequests: (identityKey: string, request: { page: number; size: number }) =>
    ["organization", "membership-requests", identityKey, request] as const,
  myMembershipRequests: (identityKey: string, request: { page: number; size: number }) =>
    ["organization", "my-membership-requests", identityKey, request] as const,
};
