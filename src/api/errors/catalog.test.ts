import { describe, expect, it } from "vitest";

import { getErrorMessage } from "./catalog";

describe("getErrorMessage", () => {
  it("uses a localized stable message for known error codes", () => {
    expect(getErrorMessage("VERSION_CONFLICT")).toContain("其他成员");
    expect(getErrorMessage("TRANSFER_TARGET_INVALID")).toContain("转审成员");
  });

  it("does not expose an unknown server message", () => {
    expect(getErrorMessage("INTERNAL_STACK_TRACE")).toBe("操作未完成，请稍后重试。");
  });

  it("maps the documented authentication error-specific suffix without rendering errMsg", () => {
    expect(getErrorMessage("DE0WARN1010311")).toContain("找回密码邮件");
  });
});
