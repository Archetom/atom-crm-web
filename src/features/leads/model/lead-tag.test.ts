import { describe, expect, it } from "vitest";

import { decodeLeadTagCatalog, normalizeLeadTagDraft } from "./lead-tag";

describe("lead tags", () => {
  it("keeps a normalized, unambiguous user draft", () => {
    expect(normalizeLeadTagDraft(["  重点线索  ", "华东"])).toEqual(["重点线索", "华东"]);
  });

  it("rejects blank, oversize, and canonically duplicated names", () => {
    expect(normalizeLeadTagDraft([""])).toBeNull();
    expect(normalizeLeadTagDraft(["A", "ａ"])).toBeNull();
    expect(normalizeLeadTagDraft(["x".repeat(51)])).toBeNull();
  });

  it("fails closed for a malformed server tag catalog", () => {
    expect(() => decodeLeadTagCatalog(["重点线索", 8])).toThrow("线索标签目录数据暂时不可用");
    expect(() => decodeLeadTagCatalog(["A", "ａ"])).toThrow("线索标签目录数据暂时不可用");
  });
});
