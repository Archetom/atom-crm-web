import { describe, expect, it } from "vitest";

import { decodeReturnVisitRelationOptions } from "./return-visit-relation-option";

describe("decodeReturnVisitRelationOptions", () => {
  it("keeps only distinct, server-visible candidates belonging to the current customer", () => {
    expect(
      decodeReturnVisitRelationOptions(
        {
          objectList: [
            { customerId: 6, id: 8, name: "张三" },
            { customerId: 6, id: 8, name: "重复项" },
            { customerId: 7, id: 9, name: "其他客户联系人" },
            { customerId: 6, id: 10, name: "" },
          ],
        },
        6,
      ),
    ).toEqual([{ id: 8, name: "张三" }]);
  });

  it("does not promote a masked or malformed customer relation into a selectable option", () => {
    expect(
      decodeReturnVisitRelationOptions(
        {
          objectList: [
            { id: 8, name: "张三" },
            { customerId: null, id: 9, name: "李四" },
          ],
        },
        6,
      ),
    ).toEqual([]);
  });
});
