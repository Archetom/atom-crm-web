export const authorizationKeys = {
  all: (identityKey: string) => ["authorization-management", identityKey] as const,
  capabilities: (identityKey: string) =>
    ["authorization-management", "capabilities", identityKey] as const,
  roles: (identityKey: string, request: { keyword?: string; page: number; size: number }) =>
    ["authorization-management", "roles", identityKey, request] as const,
  assignments: (identityKey: string, roleId: number, request: { page: number; size: number }) =>
    ["authorization-management", "assignments", identityKey, roleId, request] as const,
};
