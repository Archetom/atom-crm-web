import { describe, expect, it } from "vitest";

import { ApiError, getErrorCode } from "./api-error";

describe("ApiError", () => {
  it("uses errCode instead of exposing the server error message", () => {
    const error = ApiError.fromResponse(
      new Response(
        JSON.stringify({ errCode: "VERSION_CONFLICT", errMsg: "internal implementation detail" }),
        {
          status: 409,
        },
      ),
      { errCode: "VERSION_CONFLICT", errMsg: "internal implementation detail" },
    );

    expect(error.status).toBe(409);
    expect(error.message).toContain("其他成员");
    expect(error.message).not.toContain("implementation");
  });

  it("does not treat arbitrary payload fields as an error code", () => {
    expect(getErrorCode({ code: "VERSION_CONFLICT" })).toBeUndefined();
  });
});
