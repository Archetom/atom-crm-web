import { describe, expect, it } from "vitest";

import {
  isCompleteProductEditableBaseline,
  toProductCustomFieldUpdateValues,
  productUpdateValuesFromBaseline,
  toProductCreateRequest,
  toProductEditableBaseline,
  toProductUpdateRequest,
} from "./product-form";
import type { FieldDefinition } from "~/components/dynamic-field";

describe("toProductCreateRequest", () => {
  it("submits required product fields without arithmetic", () => {
    expect(
      toProductCreateRequest({
        availability: "AVAILABLE",
        code: " PLAN-A ",
        listPrice: 99.9,
        name: " 入门套餐 ",
      }),
    ).toEqual({
      availability: "AVAILABLE",
      code: "PLAN-A",
      listPrice: 99.9,
      name: "入门套餐",
    });
  });

  it("keeps selected optional catalog fields and omits blank text", () => {
    expect(
      toProductCreateRequest({
        availability: "UNAVAILABLE",
        categoryId: 9,
        code: " PLAN-B ",
        description: " 适合成长团队 ",
        listPrice: 199.9,
        name: " 成长套餐 ",
        unit: " 月 ",
      }),
    ).toEqual({
      availability: "UNAVAILABLE",
      categoryId: 9,
      code: "PLAN-B",
      description: "适合成长团队",
      listPrice: 199.9,
      name: "成长套餐",
      unit: "月",
    });
  });

  it("sends an owner only when it was explicitly selected", () => {
    expect(
      toProductCreateRequest({
        availability: "AVAILABLE",
        code: "PLAN-OWNER",
        listPrice: 299.9,
        name: "负责人套餐",
        ownerActorId: 9,
      }),
    ).toEqual({
      availability: "AVAILABLE",
      code: "PLAN-OWNER",
      listPrice: 299.9,
      name: "负责人套餐",
      ownerActorId: 9,
    });
  });

  it("keeps scalar custom fields and only server-governed uploaded file IDs", () => {
    expect(
      toProductCreateRequest({
        availability: "AVAILABLE",
        code: "PLAN-FIELDS",
        customFields: {
          industry: [" SaaS ", "SaaS", ""],
        },
        fileFieldSubmission: {
          draftId: 31,
          fields: {
            qualification: [41, 41, 0, -1],
            empty: [],
          },
        },
        listPrice: 99.9,
        name: "字段套餐",
      }),
    ).toEqual({
      availability: "AVAILABLE",
      code: "PLAN-FIELDS",
      customFields: { industry: ["SaaS"] },
      fileFieldDraftId: 31,
      fileFields: { qualification: [41] },
      listPrice: 99.9,
      name: "字段套餐",
    });
  });

  it("binds only valid server-issued product image draft file IDs by their declared group", () => {
    expect(
      toProductCreateRequest({
        availability: "AVAILABLE",
        code: "PLAN-IMAGES",
        listPrice: 99.9,
        name: "图片套餐",
        productImageSubmission: {
          draftId: 51,
          images: {
            DETAIL: [62, 62, 0],
            PRIMARY: [61, -1],
          },
        },
      }),
    ).toEqual({
      availability: "AVAILABLE",
      code: "PLAN-IMAGES",
      listPrice: 99.9,
      name: "图片套餐",
      productImageDraftId: 51,
      productImages: { DETAIL: [62], PRIMARY: [61] },
    });
  });
});

describe("toProductEditableBaseline", () => {
  it("accepts a complete server-authorized baseline for full replacement", () => {
    const baseline = toProductEditableBaseline({
      categoryId: 9,
      code: "PLAN-A",
      description: "适合入门团队",
      editable: true,
      id: 8,
      listPrice: 99.9,
      name: "入门套餐",
      unit: "套",
      version: 3,
    });

    expect(baseline).not.toBeNull();
    expect(baseline !== null && isCompleteProductEditableBaseline(baseline)).toBe(true);
  });

  it("rejects a non-editable baseline that leaks a business field", () => {
    expect(
      toProductEditableBaseline({ editable: false, id: 8, name: "不应返回", version: 3 }),
    ).toBeNull();
  });

  it("builds a full replacement request only from the editable baseline and form", () => {
    const baseline = toProductEditableBaseline({
      categoryId: 9,
      code: "PLAN-A",
      editable: true,
      id: 8,
      listPrice: 99.9,
      name: "入门套餐",
      version: 3,
    });
    if (baseline === null || !isCompleteProductEditableBaseline(baseline)) {
      throw new Error("Expected a complete editable baseline.");
    }

    const values = productUpdateValuesFromBaseline(baseline);
    expect(
      toProductUpdateRequest(
        { ...values, code: " PLAN-B ", description: " 适合成长团队 ", unit: " 月 " },
        baseline,
      ),
    ).toEqual({
      categoryId: 9,
      code: "PLAN-B",
      description: "适合成长团队",
      listPrice: 99.9,
      name: "入门套餐",
      unit: "月",
      version: 3,
    });
  });

  it("sends only explicit custom-field changes and preserves a deliberate clear", () => {
    const baseline = toProductEditableBaseline({
      code: "PLAN-A",
      editable: true,
      id: 8,
      listPrice: 99.9,
      name: "入门套餐",
      version: 3,
    });
    if (baseline === null || !isCompleteProductEditableBaseline(baseline)) {
      throw new Error("Expected a complete editable baseline.");
    }
    const definitions: readonly FieldDefinition[] = [
      {
        builtin: false,
        code: "industry",
        displayName: "行业",
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

    const customFields = toProductCustomFieldUpdateValues(
      definitions,
      { industry: [" SaaS "] },
      new Set(["industry", "tier", "unknown"]),
    );

    expect(customFields).toEqual({ industry: ["SaaS"], tier: [] });
    expect(
      toProductUpdateRequest(
        { ...productUpdateValuesFromBaseline(baseline), customFields },
        baseline,
      ),
    ).toMatchObject({ customFields: { industry: ["SaaS"], tier: [] }, version: 3 });
  });

  it("sends only explicit target-bound FILE field changes and preserves order or a deliberate clear", () => {
    const baseline = toProductEditableBaseline({
      code: "PLAN-FILE-UPDATE",
      editable: true,
      id: 8,
      listPrice: 99.9,
      name: "附件套餐",
      version: 3,
    });
    if (baseline === null || !isCompleteProductEditableBaseline(baseline)) {
      throw new Error("Expected a complete editable baseline.");
    }

    expect(
      toProductUpdateRequest(
        {
          ...productUpdateValuesFromBaseline(baseline),
          fileFields: {
            qualification: [51, 50, 51, 0, -1],
            obsolete_file: [],
            "not a field code": [99],
          },
        },
        baseline,
      ),
    ).toMatchObject({
      fileFields: { obsolete_file: [], qualification: [51, 50] },
      version: 3,
    });
  });
});
