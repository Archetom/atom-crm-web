import { beforeEach, describe, expect, it } from "vitest";

import { DevAuthAdapter, clearDevSession, saveDevSession } from "./dev-auth";

describe("DevAuthAdapter", () => {
  beforeEach(() => {
    clearDevSession();
  });

  it("does not prepare development identity when explicitly disabled", async () => {
    saveDevSession({ actorId: 101, tenantId: 202 });
    const adapter = new DevAuthAdapter({ enabled: false });

    expect((await adapter.bootstrap()).ready).toBe(false);
    expect(new Headers((await adapter.apply({})).headers).has("X-Dev-User-Id")).toBe(false);
  });

  it("injects bounded development headers only for an enabled session", async () => {
    saveDevSession({ actorId: 101, tenantId: 202 });
    const adapter = new DevAuthAdapter({ enabled: true });
    const request = await adapter.apply({ headers: { Accept: "application/json" } });
    const headers = new Headers(request.headers);

    expect(await adapter.bootstrap()).toMatchObject({ ready: true, actorId: 101, tenantId: 202 });
    expect(headers.get("X-Dev-User-Id")).toBe("101");
    expect(headers.get("X-Dev-Tenant-Id")).toBe("202");
    expect(headers.get("Accept")).toBe("application/json");
  });
});
