import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "~/api/errors/api-error";

const maximumRetries = 1;

/**
 * Only a server-side failure is worth retrying. A 4xx — including the 409 conflict
 * codes the application resolves explicitly — must reach the caller unretried so the
 * conflict flow can present the reviewed message and preserve the user's draft.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500 && failureCount < maximumRetries;
  return failureCount < maximumRetries;
}

/** Mutations are never retried: a repeated write is not safe to assume idempotent. */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
