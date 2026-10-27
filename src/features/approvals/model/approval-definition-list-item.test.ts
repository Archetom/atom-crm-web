import { describe, expect, it } from "vitest";

import {
  toApprovalDefinitionListItem,
  toApprovalDefinitionPage,
} from "./approval-definition-list-item";

describe("approval definition list projection", () => {
  it("keeps only a definition's public list identity, name, type, and status", () => {
    expect(
      toApprovalDefinitionListItem({
        createdTime: "2026-07-26T10:00:00",
        description: "不应进入浏览器缓存",
        id: 8,
        initiatorActorIds: [9],
        initiatorDepartmentIds: [10],
        managerActorIds: [11],
        name: "客户折扣审批",
        objectType: "CUSTOMER",
        repeatMode: "ONCE",
        status: "ACTIVE",
        steps: [{ conditions: [{ fieldCode: "discount", values: ["80"] }] }],
        updatedTime: "2026-07-26T11:00:00",
        version: 3,
      }),
    ).toEqual({ id: 8, name: "客户折扣审批", objectType: "CUSTOMER", status: "ACTIVE" });
  });

  it("fails closed for malformed facts and drops malformed page entries", () => {
    expect(
      toApprovalDefinitionListItem({
        id: 8,
        name: "客户折扣审批",
        objectType: "UNKNOWN",
        status: "ACTIVE",
      }),
    ).toBeNull();
    expect(
      toApprovalDefinitionPage({
        objectList: [
          { id: 8, name: "客户折扣审批", objectType: "CUSTOMER", status: "ACTIVE" },
          { id: 9, name: "无效对象", objectType: "UNKNOWN", status: "ACTIVE" },
        ],
        totalNum: 2,
      }),
    ).toEqual({
      items: [{ id: 8, name: "客户折扣审批", objectType: "CUSTOMER", status: "ACTIVE" }],
      total: 2,
    });
    expect(toApprovalDefinitionPage({ objectList: [], totalNum: "2" })).toBeNull();
  });
});
