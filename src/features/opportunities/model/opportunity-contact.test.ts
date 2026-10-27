import { describe, expect, it } from "vitest";

import { decodeOpportunityContacts } from "./opportunity-contact";

describe("decodeOpportunityContacts", () => {
  it("keeps only the server-visible related-contact projection", () => {
    expect(
      decodeOpportunityContacts({
        objectList: [
          { id: 8, name: "张三", primary: true, phoneNumber: "+8613812345678" },
          { id: 9, name: "李四", primary: false, email: "hidden@example.com" },
        ],
      }),
    ).toEqual([
      { id: 8, name: "张三", primary: true },
      { id: 9, name: "李四", primary: false },
    ]);
  });

  it("fails closed when the server projection is incomplete or duplicated", () => {
    expect(() => decodeOpportunityContacts({ objectList: [{ id: 8, name: "张三" }] })).toThrow(
      "商机联系人数据暂时不可用",
    );
    expect(() =>
      decodeOpportunityContacts({
        objectList: [
          { id: 8, name: "张三", primary: true },
          { id: 8, name: "李四", primary: false },
        ],
      }),
    ).toThrow("商机联系人数据暂时不可用");
  });
});
