import { describe, expect, it } from "vitest";

import { decodeContractOptions, toContractOption } from "./contract-option";

describe("contract relation options", () => {
  it("uses only server-returned contract identity and safe display values", () => {
    expect(toContractOption({ id: 8, name: "续约合同", number: "HT-008" })).toEqual({
      id: 8,
      name: "续约合同",
    });
    expect(toContractOption({ id: 8, name: null, number: "HT-008" })).toEqual({
      id: 8,
      name: "HT-008",
    });
    expect(toContractOption({ id: 8, name: null, number: null })).toEqual({
      id: 8,
      name: "合同 8",
    });
  });

  it("rejects malformed query rows and deduplicates a contract ID", () => {
    expect(
      decodeContractOptions({
        objectList: [
          { customerId: 4, id: 8, name: "续约合同", version: 0 },
          { customerId: 4, id: 8, name: "重复合同", version: 0 },
          { customerId: 4, id: 0, version: 0 },
        ],
      }),
    ).toEqual([{ id: 8, name: "续约合同" }]);
  });
});
