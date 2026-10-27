import { describe, expect, it } from "vitest";

import { decodeContactTagCatalog, normalizeContactTagDraft } from "./contact-tag";

describe("contact tags", () => {
  it("keeps a normalized, unambiguous user draft", () => {
    expect(normalizeContactTagDraft(["  重点联系人  ", "华东"])).toEqual(["重点联系人", "华东"]);
  });

  it("rejects blank, oversize, and canonically duplicated names", () => {
    expect(normalizeContactTagDraft([""])).toBeNull();
    expect(normalizeContactTagDraft(["A", "ａ"])).toBeNull();
    expect(normalizeContactTagDraft(["x".repeat(51)])).toBeNull();
  });

  it("fails closed for a malformed server tag catalog", () => {
    expect(() => decodeContactTagCatalog(["重点联系人", 8])).toThrow(
      "联系人标签目录数据暂时不可用",
    );
    expect(() => decodeContactTagCatalog(["A", "ａ"])).toThrow("联系人标签目录数据暂时不可用");
  });
});
