import { describe, expect, it } from "vitest";

import { decodeCustomerOptions } from "./customer-option";

describe("decodeCustomerOptions", () => {
  it("keeps only stable server-visible customer choices", () => {
    expect(
      decodeCustomerOptions({
        objectList: [
          { id: 7, name: "Acme", phoneNumber: "***1234" },
          { id: 7, name: "Duplicate" },
          { id: -1, name: "Invalid" },
        ],
      }),
    ).toEqual([{ id: 7, name: "Acme" }]);
  });

  it("rejects an invalid page envelope", () => {
    expect(() => decodeCustomerOptions({})).toThrow("客户选择数据暂时不可用");
  });
});
