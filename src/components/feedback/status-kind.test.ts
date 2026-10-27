import { describe, expect, it } from "vitest";

import { ApiError } from "~/api/errors/api-error";

import { statusKindFromError } from "./status-kind";

describe("statusKindFromError", () => {
  it("distinguishes version conflicts from duplicate resources", () => {
    expect(statusKindFromError(new ApiError(409, "VERSION_CONFLICT"))).toBe("conflict");
    expect(statusKindFromError(new ApiError(409, "CONCURRENT_OPERATION"))).toBe("conflict");
    expect(statusKindFromError(new ApiError(409, "RESOURCE_ALREADY_EXISTS"))).toBe(
      "duplicate-resource",
    );
  });

  it("does not classify an unknown 409 code as a safe refresh conflict", () => {
    expect(statusKindFromError(new ApiError(409, "UNREVIEWED_CONFLICT"))).toBe("unavailable");
  });
});
