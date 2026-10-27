import type { AuthAdapter, AuthBootstrapState, DevelopmentSession } from "./auth-adapter";

const actorStorageKey = "atom-crm.dev.actor-id";
const tenantStorageKey = "atom-crm.dev.tenant-id";
const devUserHeader = "X-Dev-User-Id";
const devTenantHeader = "X-Dev-Tenant-Id";

export interface DevSession {
  actorId: number;
  tenantId: number;
}

interface DevAuthOptions {
  enabled?: boolean;
}

export function isDevAuthEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_DEV_AUTH === "true";
}

export function readDevSession(): DevSession | null {
  const actorId = Number.parseInt(sessionStorage.getItem(actorStorageKey) ?? "", 10);
  const tenantId = Number.parseInt(sessionStorage.getItem(tenantStorageKey) ?? "", 10);

  if (
    !Number.isSafeInteger(actorId) ||
    actorId <= 0 ||
    !Number.isSafeInteger(tenantId) ||
    tenantId <= 0
  ) {
    return null;
  }

  return { actorId, tenantId };
}

export function saveDevSession(session: DevSession): void {
  sessionStorage.setItem(actorStorageKey, String(session.actorId));
  sessionStorage.setItem(tenantStorageKey, String(session.tenantId));
}

export function clearDevSession(): void {
  sessionStorage.removeItem(actorStorageKey);
  sessionStorage.removeItem(tenantStorageKey);
}

export class DevAuthAdapter implements AuthAdapter {
  private readonly enabled: boolean;

  constructor(options: DevAuthOptions = {}) {
    this.enabled = options.enabled ?? isDevAuthEnabled();
  }

  async bootstrap(): Promise<AuthBootstrapState> {
    const session = this.enabled ? readDevSession() : null;
    if (!session) {
      return { mode: "development", ready: false, identityKey: "development-session-required" };
    }

    return {
      mode: "development",
      ready: true,
      identityKey: `development:${session.tenantId}:${session.actorId}`,
      ...session,
    };
  }

  async apply(request: RequestInit): Promise<RequestInit> {
    const session = this.enabled ? readDevSession() : null;
    if (!session) return { ...request, credentials: "same-origin" };

    const headers = new Headers(request.headers);
    headers.set(devUserHeader, String(session.actorId));
    headers.set(devTenantHeader, String(session.tenantId));

    return { ...request, credentials: "same-origin", headers };
  }

  async handleUnauthorized(): Promise<void> {
    clearDevSession();
    window.location.assign("/dev/session");
  }

  async replaceDevelopmentSession(session: DevelopmentSession): Promise<void> {
    saveDevSession(session);
  }

  async logout(): Promise<void> {
    clearDevSession();
  }
}

export function createDevAuthAdapter(): AuthAdapter {
  return new DevAuthAdapter();
}
