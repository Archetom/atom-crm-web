import { describe, expect, it } from "vitest";

import { decodeInvoiceProfileList, toInvoiceProfileListItem } from "./invoice-profile-list-item";

describe("toInvoiceProfileListItem", () => {
  it("keeps the narrow customer invoice-profile projection", () => {
    expect(
      toInvoiceProfileListItem({
        id: 8,
        customerId: 4,
        version: 3,
        titleType: "ORGANIZATION",
        title: "示例科技有限公司",
        taxNumber: "91310000EXAMPLE",
        bankName: "不进入列表状态",
        bankAccount: "6222-ignored",
        registeredAddress: "不进入列表状态",
        registeredPhone: "不进入列表状态",
        remark: "不进入列表状态",
        updatedTime: "2026-07-26T09:00:00",
      }),
    ).toEqual({
      id: 8,
      customerId: 4,
      version: 3,
      titleType: "ORGANIZATION",
      title: "示例科技有限公司",
      taxNumber: "91310000EXAMPLE",
      updatedTime: "2026-07-26T09:00:00",
    });
  });

  it("fails closed when any profile lacks a stable customer identity and version", () => {
    expect(
      toInvoiceProfileListItem({ customerId: 4, id: 8, title: "示例", titleType: "INDIVIDUAL" }),
    ).toBeNull();
    expect(
      toInvoiceProfileListItem({
        customerId: 0,
        id: 8,
        title: "示例",
        titleType: "INDIVIDUAL",
        version: 0,
      }),
    ).toBeNull();
    expect(
      decodeInvoiceProfileList([{ customerId: 4, id: 8, title: "示例", titleType: "INDIVIDUAL" }]),
    ).toBeNull();
  });
});
