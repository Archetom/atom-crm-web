import { describe, expect, it } from "vitest";

import { isGrantedTenantAccess } from "./tenant-access";

describe("isGrantedTenantAccess", () => {
  it("only accepts a server-confirmed positive tenant membership", () => {
    expect(isGrantedTenantAccess({ tenantId: 8, granted: true })).toBe(true);
    expect(isGrantedTenantAccess({ tenantId: 8, granted: false })).toBe(false);
    expect(isGrantedTenantAccess({ granted: true })).toBe(false);
    expect(isGrantedTenantAccess({ tenantId: 0, granted: true })).toBe(false);
  });
});
