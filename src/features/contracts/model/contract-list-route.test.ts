import { describe, expect, it } from "vitest";

import { selectedContractIdFromSearch } from "./contract-list-route";

describe("contract list detail selection", () => {
  it("restores only a positive safe contract ID from the list URL", () => {
    expect(selectedContractIdFromSearch("keyword=renewal&contractId=42")).toBe(42);
    expect(selectedContractIdFromSearch("contractId=0")).toBeNull();
    expect(selectedContractIdFromSearch("contractId=-42")).toBeNull();
    expect(selectedContractIdFromSearch("contractId=42.5")).toBeNull();
    expect(selectedContractIdFromSearch("contractId=9007199254740992")).toBeNull();
  });
});
