import { getBrowserSession, withBrowserSession } from "./browser-session";

export type AuthMode = "development" | "production";

export interface AuthBootstrapState {
  mode: AuthMode;
  ready: boolean;
  identityKey: string;
  actorId?: number;
  tenantId?: number;
}

export interface DevelopmentSession {
  actorId: number;
  tenantId: number;
}

export interface AuthAdapter {
  bootstrap(): Promise<AuthBootstrapState>;
  apply(request: RequestInit): Promise<RequestInit>;
  handleUnauthorized(): Promise<void>;
  logout?(): Promise<void>;
  replaceDevelopmentSession?(session: DevelopmentSession): Promise<void>;
}

class BrowserSessionAuthAdapter implements AuthAdapter {
  async bootstrap(): Promise<AuthBootstrapState> {
    const session = await getBrowserSession();
    if (!session)
      return { mode: "production", ready: false, identityKey: "browser-session-required" };
    return {
      mode: "production",
      ready: true,
      identityKey: `browser:${session.tenantId}:${session.actorId}`,
      actorId: session.actorId,
      tenantId: session.tenantId,
    };
  }

  async apply(request: RequestInit): Promise<RequestInit> {
    return withBrowserSession(request);
  }

  async handleUnauthorized(): Promise<void> {
    const path = `${window.location.pathname}${window.location.search}`;
    if (window.location.pathname !== "/login") {
      window.location.assign(`/login?next=${encodeURIComponent(path)}`);
    }
  }

  async logout(): Promise<void> {
    const response = await fetch(
      "/api/v1/authentication/session",
      withBrowserSession({ method: "DELETE" }),
    );
    if (!response.ok && response.status !== 401) {
      throw new Error("退出登录暂时无法完成，请稍后重试。");
    }
  }
}

export async function createAuthAdapter(): Promise<AuthAdapter> {
  if (import.meta.env.DEV) {
    const { createDevAuthAdapter, isDevAuthEnabled, readDevSession } = await import("./dev-auth");
    if (isDevAuthEnabled() && readDevSession()) return createDevAuthAdapter();
  }

  return new BrowserSessionAuthAdapter();
}
