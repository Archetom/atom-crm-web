export const fieldCustomizationKeys = {
  all: (identityKey: string) => ["field-customization", identityKey] as const,
  objects: (identityKey: string) => ["field-customization", identityKey, "objects"] as const,
  definitions: (identityKey: string, objectType: string, includeInactive: boolean) =>
    ["field-customization", identityKey, "definitions", objectType, includeInactive] as const,
  layout: (identityKey: string, objectType: string) =>
    ["field-customization", identityKey, "layout", objectType] as const,
  roles: (identityKey: string) => ["field-customization", identityKey, "roles"] as const,
  policy: (identityKey: string, roleId: number, objectType: string) =>
    ["field-customization", identityKey, "policy", roleId, objectType] as const,
};
