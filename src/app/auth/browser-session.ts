import type { components, paths } from "~/api/generated/schema";
import createClient from "openapi-fetch";

const csrfCookieName = "atom_crm_csrf";
const csrfHeaderName = "X-Atom-CSRF";

export type BrowserSession = components["schemas"]["AuthenticationSessionResponse"];

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;

  const prefix = `${name}=`;
  for (const cookie of document.cookie.split(";")) {
    const normalized = cookie.trim();
    if (!normalized.startsWith(prefix)) continue;
    return decodeURIComponent(normalized.slice(prefix.length));
  }
  return undefined;
}

function unsafeMethod(method: string | undefined): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes((method ?? "GET").toUpperCase());
}

export function withBrowserSession(request: RequestInit): RequestInit {
  const headers = new Headers(request.headers);
  const csrfToken = readCookie(csrfCookieName);
  if (csrfToken && unsafeMethod(request.method)) headers.set(csrfHeaderName, csrfToken);
  return { ...request, credentials: "same-origin", headers };
}

function validSession(value: unknown): value is BrowserSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.actorId === "number" &&
    Number.isSafeInteger(candidate.actorId) &&
    candidate.actorId > 0 &&
    typeof candidate.tenantId === "number" &&
    Number.isSafeInteger(candidate.tenantId) &&
    candidate.tenantId > 0 &&
    typeof candidate.expiresAt === "string" &&
    Number.isFinite(Date.parse(candidate.expiresAt))
  );
}

export async function getBrowserSession(): Promise<BrowserSession | null> {
  const client = createClient<paths>({ baseUrl: "" });
  client.use({
    onRequest({ request }) {
      return new Request(
        request,
        withBrowserSession({
          credentials: "same-origin",
          headers: new Headers(request.headers),
          method: request.method,
        }),
      );
    },
  });

  const { data, response } = await client.GET("/api/v1/authentication/session", {});
  if (response.status === 401) return null;
  if (!response.ok || !validSession(data)) {
    throw new Error("浏览器登录状态暂时无法确认，请稍后重试。");
  }
  return data;
}
