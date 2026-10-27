import { describe, expect, it } from "vitest";

import { ApiError } from "./api-error";
import { getMutationConflict, requiresConflictRefresh } from "./mutation-conflict";

describe("getMutationConflict", () => {
  it.each([
    ["VERSION_CONFLICT", "version-conflict", true],
    ["CONCURRENT_OPERATION", "concurrent-operation", true],
    ["RESOURCE_ALREADY_EXISTS", "resource-already-exists", false],
  ] as const)("routes %s by errCode", (code, kind, refreshes) => {
    const conflict = getMutationConflict(new ApiError(409, code));

    expect(conflict?.kind).toBe(kind);
    expect(conflict && requiresConflictRefresh(conflict)).toBe(refreshes);
  });

  it("does not treat every HTTP 409 as a version conflict", () => {
    expect(getMutationConflict(new ApiError(409, "UNREVIEWED_CONFLICT"))).toBeNull();
    expect(getMutationConflict(new ApiError(422, "VERSION_CONFLICT"))).toBeNull();
  });
});
