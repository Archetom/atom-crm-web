import { describe, expect, it } from "vitest";

import {
  customerBaseFormSchema,
  customerBaseFormValuesFromDetail,
  toCustomerCreateRequest,
  toCustomerCustomFieldUpdateRequest,
  toCustomerDuplicateCheckRequest,
  toCustomerUpdateRequest,
} from "./customer-form";
import type { FieldDefinition } from "~/components/dynamic-field";

describe("customer base form", () => {
  it("serializes only explicitly provided base values for creation", () => {
    const values = customerBaseFormSchema.parse({
      name: "  Acme  ",
      phoneNumber: "  +8613812345678 ",
      telephone: "",
      email: "  sales@example.test ",
      website: "",
      description: "  重点客户 ",
      addressLine: "  虹桥路 1 号  ",
      addressRegion: "  上海市  ",
      addressCity: "  上海  ",
      addressPostalCode: "  200030  ",
      customFields: { cf_source: ["  direct  ", "direct", ""] },
      tags: ["  华东  "],
    });

    expect(
      toCustomerCreateRequest(values, undefined, {
        draftId: 51,
        fields: { cf_qualification: [61, 61, 0], ignored: [] },
      }),
    ).toEqual({
      name: "Acme",
      phoneNumber: "+8613812345678",
      email: "sales@example.test",
      description: "重点客户",
      addresses: [
        {
          addressLine: "虹桥路 1 号",
          region: "上海市",
          city: "上海",
          postalCode: "200030",
          primary: true,
        },
      ],
      customFields: { cf_source: ["direct"] },
      fileFieldDraftId: 51,
      fileFields: { cf_qualification: [61] },
      tags: ["华东"],
    });
  });

  it("includes only an explicitly selected server member as the creation owner", () => {
    const values = customerBaseFormSchema.parse({
      name: "Acme",
      phoneNumber: "",
      telephone: "",
      email: "",
      website: "",
      description: "",
      addressLine: "",
      addressRegion: "",
      addressCity: "",
      addressPostalCode: "",
      customFields: {},
      tags: [],
      ownerActorId: 9,
    });

    expect(toCustomerCreateRequest(values)).toEqual({ name: "Acme", ownerActorId: 9 });
  });

  it("includes only a positive server-confirmed parent customer ID for creation", () => {
    const values = customerBaseFormSchema.parse({
      name: "Acme 子公司",
      phoneNumber: "",
      telephone: "",
      email: "",
      website: "",
      description: "",
      addressLine: "",
      addressRegion: "",
      addressCity: "",
      addressPostalCode: "",
      customFields: {},
      tags: [],
    });

    expect(toCustomerCreateRequest(values, 8)).toEqual({
      name: "Acme 子公司",
      parentCustomerId: 8,
    });
    expect(toCustomerCreateRequest(values, 0)).toEqual({ name: "Acme 子公司" });
  });

  it("rejects a phone number without an E.164 country prefix", () => {
    expect(
      customerBaseFormSchema.safeParse({
        name: "Acme",
        phoneNumber: "13812345678",
        telephone: "",
        email: "",
        website: "",
        description: "",
        addressLine: "",
        addressRegion: "",
        addressCity: "",
        addressPostalCode: "",
        customFields: {},
        tags: [],
      }).success,
    ).toBe(false);
  });

  it("uses only visible base inputs for a duplicate check", () => {
    expect(
      toCustomerDuplicateCheckRequest(
        {
          name: " Acme ",
          phoneNumber: " +8613812345678 ",
          telephone: "",
          email: "",
          website: "",
          description: "",
          addressLine: "",
          addressRegion: "",
          addressCity: "",
          addressPostalCode: "",
          customFields: {},
          tags: [],
        },
        7,
      ),
    ).toEqual({ excludedCustomerId: 7, name: "Acme", phoneNumber: "+8613812345678" });
  });

  it("requires an address line when a location part is explicitly entered", () => {
    expect(
      customerBaseFormSchema.safeParse({
        name: "Acme",
        phoneNumber: "",
        telephone: "",
        email: "",
        website: "",
        description: "",
        addressLine: "",
        addressRegion: "上海市",
        addressCity: "",
        addressPostalCode: "",
        customFields: {},
        tags: [],
      }).success,
    ).toBe(false);
  });

  it("serializes only changed fields with the original optimistic-lock version", () => {
    const baseline = customerBaseFormValuesFromDetail({
      id: 7,
      version: 3,
      name: "Acme",
      ownerActorId: null,
      parentCustomerId: null,
      phoneNumber: "+8613812345678",
      telephone: null,
      email: null,
      website: null,
      description: "旧说明",
      status: null,
      locked: false,
      starred: false,
      dealStatus: null,
      tags: [],
      createdTime: null,
      updatedTime: null,
    });

    expect(toCustomerUpdateRequest({ ...baseline, description: "" }, baseline, 3)).toEqual({
      version: 3,
      description: "",
    });
    expect(toCustomerUpdateRequest(baseline, baseline, 3)).toEqual({ version: 3 });
  });

  it("serializes only explicitly changed, catalog-backed custom fields", () => {
    const definitions: FieldDefinition[] = [
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
      toCustomerCustomFieldUpdateRequest(definitions, {
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
