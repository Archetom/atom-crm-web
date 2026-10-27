import { describe, expect, it } from "vitest";

import { decodeOpportunityContactsBaseline } from "./opportunity-contacts-baseline";

describe("decodeOpportunityContactsBaseline", () => {
  it("keeps an editable complete replacement baseline", () => {
    expect(
      decodeOpportunityContactsBaseline({
        contacts: [{ id: 9, name: "张三", primary: true }],
        customerId: 7,
        editable: true,
        id: 8,
        version: 3,
      }),
    ).toEqual({
      contacts: [{ id: 9, name: "张三", primary: true }],
      customerId: 7,
      editable: true,
      id: 8,
      version: 3,
    });
  });

  it("fails closed when a non-editable response leaks relationship values", () => {
    expect(() =>
      decodeOpportunityContactsBaseline({
        contacts: [],
        editable: false,
        id: 8,
        version: 3,
      }),
    ).toThrow("商机联系人完整基线暂时不可用");
  });

  it("fails closed for duplicate or ambiguous primary contacts", () => {
    expect(() =>
      decodeOpportunityContactsBaseline({
        contacts: [
          { id: 9, name: "张三", primary: true },
          { id: 10, name: "李四", primary: true },
        ],
        customerId: 7,
        editable: true,
        id: 8,
        version: 3,
      }),
    ).toThrow("商机联系人完整基线暂时不可用");
  });
});
