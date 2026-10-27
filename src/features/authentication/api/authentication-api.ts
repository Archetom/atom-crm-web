import createClient from "openapi-fetch";

import { withBrowserSession } from "~/app/auth/browser-session";
import { ApiError } from "~/api/errors/api-error";
import type { components, paths } from "~/api/generated/schema";

async function readPayload(response: Response, fallback: unknown): Promise<unknown> {
  if (fallback !== undefined) return fallback;
  try {
    return await response.clone().json();
  } catch {
    return undefined;
  }
}

interface ApiResponse<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

async function result<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const { data, error, response } = await request;
  if (response.ok && data !== undefined) return data;
  throw ApiError.fromResponse(response, await readPayload(response, error));
}

async function accepted(request: Promise<ApiResponse<unknown>>): Promise<void> {
  const { error, response } = await request;
  if (response.ok) return;
  throw ApiError.fromResponse(response, await readPayload(response, error));
}

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

export const authenticationApi = {
  beginPasswordLogin: (body: components["schemas"]["PasswordLoginOptionsRequest"]) =>
    result<components["schemas"]["PasswordLoginOptionsResponse"]>(
      client.POST("/api/v1/authentication/password/login-options", { body }),
    ),
  createPasswordSession: (body: components["schemas"]["PasswordSessionCreateRequest"]) =>
    result<components["schemas"]["AuthenticationSessionResponse"]>(
      client.POST("/api/v1/authentication/password/sessions", { body }),
    ),
  requestPasswordReset: (body: components["schemas"]["PasswordResetRequest"]) =>
    accepted(client.POST("/api/v1/authentication/password/reset-requests", { body })),
  confirmPasswordReset: (body: components["schemas"]["PasswordResetConfirmRequest"]) =>
    accepted(client.POST("/api/v1/authentication/password/reset-confirmations", { body })),
  getInitialInstallationStatus: () =>
    result<components["schemas"]["InitialInstallationStatusResponse"]>(
      client.GET("/api/v1/installation"),
    ),
  initializeTenantAdmin: (body: components["schemas"]["InitialTenantAdminRequest"]) =>
    result<components["schemas"]["AuthenticationSessionResponse"]>(
      client.POST("/api/v1/installation/tenant-admin", { body }),
    ),
};
