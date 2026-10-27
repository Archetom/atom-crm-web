import { describe, expect, it } from "vitest";

import { ApiError } from "~/api/errors/api-error";

import { createAppQueryClient, shouldRetryQuery } from "./query-client";

describe("shouldRetryQuery", () => {
  it("never retries a conflict so the explicit 409 flow keeps the user's draft", () => {
    for (const code of ["VERSION_CONFLICT", "CONCURRENT_OPERATION", "RESOURCE_ALREADY_EXISTS"]) {
      expect(shouldRetryQuery(0, new ApiError(409, code))).toBe(false);
    }
  });

  it("never retries other client failures", () => {
    expect(shouldRetryQuery(0, new ApiError(400, "VALIDATION_FAILED"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(401, "AUTH_102"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(403, "FORBIDDEN"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(404, "RESOURCE_NOT_FOUND"))).toBe(false);
  });

  it("retries a server failure exactly once", () => {
    expect(shouldRetryQuery(0, new ApiError(500, undefined))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError(500, undefined))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(503, "SERVICE_UNAVAILABLE"))).toBe(true);
  });

  it("retries a transport failure once, because it carries no status to classify", () => {
    expect(shouldRetryQuery(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetryQuery(1, new TypeError("Failed to fetch"))).toBe(false);
  });
});

describe("createAppQueryClient", () => {
  it("never retries a mutation and does not refetch on window focus", () => {
    const defaults = createAppQueryClient().getDefaultOptions();

    expect(defaults.mutations?.retry).toBe(false);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.queries?.retry).toBe(shouldRetryQuery);
  });
});
