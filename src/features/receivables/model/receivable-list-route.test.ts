import { describe, expect, it } from "vitest";

import { selectedReceivableIdFromSearch } from "./receivable-list-route";

describe("receivable list detail selection", () => {
  it("restores only a positive safe receivable ID from the list URL", () => {
    expect(selectedReceivableIdFromSearch("keyword=refund&receivableId=42")).toBe(42);
    expect(selectedReceivableIdFromSearch("receivableId=0")).toBeNull();
    expect(selectedReceivableIdFromSearch("receivableId=-42")).toBeNull();
    expect(selectedReceivableIdFromSearch("receivableId=42.5")).toBeNull();
    expect(selectedReceivableIdFromSearch("receivableId=9007199254740992")).toBeNull();
  });
});
