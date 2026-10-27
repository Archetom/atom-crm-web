import { describe, expect, it } from "vitest";

import {
  toContractBasicUpdateRequest,
  toContractCreateRequest,
  toContractCustomFieldUpdateRequest,
} from "./contract-form";
import type { FieldDefinition } from "~/components/dynamic-field";

describe("toContractCreateRequest", () => {
  it("uses the generated create contract with user-entered line prices", () => {
    expect(
      toContractCreateRequest({
        customerId: 4,
        name: " 年度续约 ",
        number: " HT-20260726-0008 ",
        products: [{ productId: 9, quantity: 2.5, unitPrice: 89.9 }],
      }),
    ).toEqual({
      customerId: 4,
      name: "年度续约",
      number: "HT-20260726-0008",
      products: [{ productId: 9, quantity: 2.5, unitPrice: 89.9 }],
    });
  });

  it("keeps optional dates and details while omitting blank text", () => {
    expect(
      toContractCreateRequest({
        contractType: " 年度服务 ",
        customerId: 4,
        discountRate: 5,
        endDate: "2026-12-31",
        name: " 年度续约 ",
        number: " HT-20260726-0008 ",
        orderDate: "2026-07-26",
        paymentType: " 月结 ",
        products: [],
        remark: "  ",
        startDate: "2026-08-01",
      }),
    ).toEqual({
      contractType: "年度服务",
      customerId: 4,
      discountRate: 5,
      endDate: "2026-12-31",
      name: "年度续约",
      number: "HT-20260726-0008",
      orderDate: "2026-07-26",
      paymentType: "月结",
      products: [],
      startDate: "2026-08-01",
    });
  });

  it("sends only explicitly selected customer-scoped contact and opportunity IDs", () => {
    expect(
      toContractCreateRequest({
        contactId: 7,
        customerId: 4,
        name: "年度续约",
        number: "HT-20260726-0008",
        opportunityId: 8,
        products: [],
      }),
    ).toEqual({
      contactId: 7,
      customerId: 4,
      name: "年度续约",
      number: "HT-20260726-0008",
      opportunityId: 8,
      products: [],
    });
  });

  it("keeps an explicit empty product collection when the user makes no selection", () => {
    expect(
      toContractCreateRequest({
        customerId: 4,
        name: "年度续约",
        number: "HT-20260726-0008",
        products: [],
      }),
    ).toMatchObject({ products: [] });
  });

  it("sends an owner only when explicitly selected from the member directory", () => {
    expect(
      toContractCreateRequest({
        customerId: 4,
        name: "年度续约",
        number: "HT-20260726-0008",
        ownerActorId: 9,
        products: [],
      }),
    ).toEqual({
      customerId: 4,
      name: "年度续约",
      number: "HT-20260726-0008",
      ownerActorId: 9,
      products: [],
    });
  });

  it("keeps catalog-backed custom fields and only server-confirmed CONTRACT draft file IDs", () => {
    expect(
      toContractCreateRequest({
        customerId: 4,
        customFields: { source: [" 续约 ", "续约", ""] },
        fileFieldSubmission: {
          draftId: 31,
          fields: { agreement: [41, 41, 0, -1], empty: [] },
        },
        name: "年度续约",
        number: "HT-20260726-0008",
        products: [],
      }),
    ).toEqual({
      customerId: 4,
      customFields: { source: ["续约"] },
      fileFieldDraftId: 31,
      fileFields: { agreement: [41] },
      name: "年度续约",
      number: "HT-20260726-0008",
      products: [],
    });
  });

  it("submits only changed basic fields with the current version", () => {
    expect(
      toContractBasicUpdateRequest({
        name: "续约合同",
        number: "HT-20260726-0008",
        originalName: "原合同",
        originalNumber: "HT-20260726-0008",
        version: 3,
      }),
    ).toEqual({ name: "续约合同", version: 3 });
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

    expect(
      toContractCustomFieldUpdateRequest(definitions, {
        changedCodes: new Set(["source", "tier", "unknown"]),
        customFields: { source: [" renewal "] },
        version: 7,
      }),
    ).toEqual({
      customFields: { source: ["renewal"], tier: [] },
      version: 7,
    });
  });
});
