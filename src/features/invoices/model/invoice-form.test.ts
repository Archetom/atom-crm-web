import { describe, expect, it } from "vitest";

import {
  toInvoiceBasicUpdateRequest,
  toInvoiceCreateRequest,
  toInvoiceCustomFieldUpdateRequest,
  toInvoiceCustomFieldUpdateValues,
} from "./invoice-form";
import type { FieldDefinition } from "~/components/dynamic-field";

describe("toInvoiceCreateRequest", () => {
  it("uses the generated invoice creation contract for an individual title", () => {
    expect(
      toInvoiceCreateRequest({
        amount: 12.34,
        contractId: 8,
        invoiceType: " 增值税普通发票 ",
        title: " 张三 ",
        titleType: "INDIVIDUAL",
      }),
    ).toEqual({
      amount: 12.34,
      contractId: 8,
      invoiceType: "增值税普通发票",
      title: "张三",
      titleType: "INDIVIDUAL",
    });
  });

  it("includes optional unit-title, date, shipping, and remark values", () => {
    expect(
      toInvoiceCreateRequest({
        amount: 12.34,
        bankAccount: " 6222 0000 ",
        bankName: " 开户银行 ",
        contactName: " 王五 ",
        contactPhone: " 13800000000 ",
        contractId: 8,
        invoiceType: " 增值税专用发票 ",
        registeredAddress: " 上海市 ",
        registeredPhone: " 021-00000000 ",
        remark: " 纸质发票 ",
        requestedDate: "2026-08-09",
        shippingAddress: " 上海市浦东新区 ",
        taxNumber: " 91310000XXXX ",
        title: " 示例公司 ",
        titleType: "ORGANIZATION",
      }),
    ).toEqual({
      amount: 12.34,
      bankAccount: "6222 0000",
      bankName: "开户银行",
      contactName: "王五",
      contactPhone: "13800000000",
      contractId: 8,
      invoiceType: "增值税专用发票",
      registeredAddress: "上海市",
      registeredPhone: "021-00000000",
      remark: "纸质发票",
      requestedDate: "2026-08-09",
      shippingAddress: "上海市浦东新区",
      taxNumber: "91310000XXXX",
      title: "示例公司",
      titleType: "ORGANIZATION",
    });
  });

  it("sends an owner only when explicitly selected from the member directory", () => {
    expect(
      toInvoiceCreateRequest({
        amount: 12.34,
        contractId: 8,
        invoiceType: "增值税普通发票",
        ownerActorId: 9,
        title: "张三",
        titleType: "INDIVIDUAL",
      }),
    ).toEqual({
      amount: 12.34,
      contractId: 8,
      invoiceType: "增值税普通发票",
      ownerActorId: 9,
      title: "张三",
      titleType: "INDIVIDUAL",
    });
  });

  it("does not transmit unit-title fields for an individual title", () => {
    expect(
      toInvoiceCreateRequest({
        amount: 12.34,
        bankName: "不应发送",
        contractId: 8,
        invoiceType: "增值税普通发票",
        taxNumber: "不应发送",
        title: "张三",
        titleType: "INDIVIDUAL",
      }),
    ).toEqual({
      amount: 12.34,
      contractId: 8,
      invoiceType: "增值税普通发票",
      title: "张三",
      titleType: "INDIVIDUAL",
    });
  });

  it("serializes catalog values and files from the same INVOICE draft only", () => {
    expect(
      toInvoiceCreateRequest({
        amount: 12.34,
        contractId: 8,
        customFields: { source: ["  referral ", "referral", ""] },
        fileFieldSubmission: {
          draftId: 17,
          fields: { invoice_scan: [9, 9, 0] },
        },
        invoiceType: "增值税普通发票",
        title: "张三",
        titleType: "INDIVIDUAL",
      }),
    ).toEqual({
      amount: 12.34,
      contractId: 8,
      customFields: { source: ["referral"] },
      fileFieldDraftId: 17,
      fileFields: { invoice_scan: [9] },
      invoiceType: "增值税普通发票",
      title: "张三",
      titleType: "INDIVIDUAL",
    });
  });

  it("submits only changed safe invoice fields with the current version", () => {
    expect(
      toInvoiceBasicUpdateRequest({
        invoiceType: " 增值税普通发票 ",
        originalInvoiceType: "VAT",
        originalRequestedDate: "2026-07-25",
        requestedDate: "2026-07-25",
        version: 3,
      }),
    ).toEqual({ invoiceType: "增值税普通发票", version: 3 });
  });

  it("merges only explicit catalog-backed custom-field changes", () => {
    const definitions: readonly FieldDefinition[] = [
      {
        builtin: false,
        code: "source",
        displayName: "来源",
        displayOrder: 1,
        fieldType: "TEXT",
        options: [],
        required: false,
        searchable: false,
        sectionName: null,
        status: "ACTIVE",
      },
      {
        builtin: false,
        code: "tier",
        displayName: "等级",
        displayOrder: 2,
        fieldType: "SELECT",
        options: [{ label: "A", order: 0, value: "a" }],
        required: false,
        searchable: false,
        sectionName: null,
        status: "ACTIVE",
      },
    ];
    const changedCodes = new Set(["source", "tier", "unknown"]);

    expect(
      toInvoiceCustomFieldUpdateValues(definitions, { source: [" referral "] }, changedCodes),
    ).toEqual({ source: ["referral"], tier: [] });
    expect(
      toInvoiceCustomFieldUpdateRequest(definitions, { source: [" referral "] }, changedCodes, 3),
    ).toEqual({ customFields: { source: ["referral"], tier: [] }, version: 3 });
  });
});
