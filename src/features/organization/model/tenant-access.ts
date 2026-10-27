import type { components } from "~/api/generated/schema";

export type TenantAccess = components["schemas"]["TenantAccessResponse"];

export function isGrantedTenantAccess(
  access: TenantAccess,
): access is TenantAccess & { tenantId: number; granted: true } {
  return (
    access.granted === true &&
    typeof access.tenantId === "number" &&
    Number.isSafeInteger(access.tenantId) &&
    access.tenantId > 0
  );
}
