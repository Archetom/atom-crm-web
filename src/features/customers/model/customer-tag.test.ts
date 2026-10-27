import { describe, expect, it } from "vitest";

import { decodeCustomerTagCatalog, normalizeCustomerTagDraft } from "./customer-tag";

describe("customer tags", () => {
  it("keeps a normalized, unambiguous user draft", () => {
    expect(normalizeCustomerTagDraft(["  重点客户  ", "华东"])).toEqual(["重点客户", "华东"]);
  });

  it("rejects blank, oversize, and canonically duplicated names", () => {
    expect(normalizeCustomerTagDraft([""])).toBeNull();
    expect(normalizeCustomerTagDraft(["A", "ａ"])).toBeNull();
    expect(normalizeCustomerTagDraft(["x".repeat(51)])).toBeNull();
  });

  it("fails closed for a malformed server tag catalog", () => {
    expect(() => decodeCustomerTagCatalog(["重点客户", 8])).toThrow("客户标签目录数据暂时不可用");
    expect(() => decodeCustomerTagCatalog(["A", "ａ"])).toThrow("客户标签目录数据暂时不可用");
  });
});
