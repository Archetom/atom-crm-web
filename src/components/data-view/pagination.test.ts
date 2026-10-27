import { describe, expect, it } from "vitest";

import { normalizePageRequest, toPageResult } from "./pagination";

describe("pagination adapters", () => {
  it("uses the CRM list default of 15 records per page", () => {
    expect(normalizePageRequest({})).toEqual({ page: 1, size: 15 });
  });

  it("keeps page input one-based and bounds its page size", () => {
    expect(normalizePageRequest({ page: 0, size: 999 })).toEqual({ page: 1, size: 200 });
  });

  it("preserves the no-total Pager contract", () => {
    const result = toPageResult(
      { pageNum: 2, pageSize: 20, totalNum: -1, objectList: [{ id: 1 }, { ignored: true }] },
      (value) => {
        if (!value || typeof value !== "object" || !("id" in value)) return null;
        return { id: value.id };
      },
    );

    expect(result).toMatchObject({ page: 2, size: 20, total: null, items: [{ id: 1 }] });
  });
});
