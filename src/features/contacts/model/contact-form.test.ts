import { describe, expect, it } from "vitest";

import {
  contactBaseFormSchema,
  contactBaseFormValuesFromDetail,
  toContactCreateRequest,
  toContactCustomFieldUpdateRequest,
  toContactDuplicateCheckRequest,
  toContactUpdateRequest,
} from "./contact-form";
import type { FieldDefinition } from "~/components/dynamic-field";

describe("contact base form", () => {
  it("serializes only explicitly provided basic values for creation", () => {
    const values = contactBaseFormSchema.parse({
      name: "  张三  ",
      phoneNumber: "  +8613812345678 ",
      telephone: "",
      jobTitle: "  采购经理 ",
      email: "  buyer@example.test ",
      website: "",
      description: "  重点联系人 ",
      nextContactTime: "2026-07-25T09:30",
      addressLine: "  浦东新区世纪大道 1 号 ",
      addressRegion: " 上海市 ",
      addressCity: " 上海 ",
      addressPostalCode: " 200120 ",
      tags: ["  重点  ", "华东"],
    });

    expect(toContactCreateRequest(values)).toEqual({
      name: "张三",
      phoneNumber: "+8613812345678",
      jobTitle: "采购经理",
      email: "buyer@example.test",
      description: "重点联系人",
      nextContactTime: "2026-07-25T09:30",
      addresses: [
        {
          addressLine: "浦东新区世纪大道 1 号",
          region: "上海市",
          city: "上海",
          postalCode: "200120",
          primary: true,
        },
      ],
      tags: ["重点", "华东"],
    });
  });

  it("rejects a phone number without an E.164 country prefix", () => {
    expect(
      contactBaseFormSchema.safeParse({
        name: "张三",
        phoneNumber: "13812345678",
        telephone: "",
        jobTitle: "",
        email: "",
        website: "",
        description: "",
        nextContactTime: "",
        addressLine: "",
        addressRegion: "",
        addressCity: "",
        addressPostalCode: "",
        tags: [],
      }).success,
    ).toBe(false);
  });

  it("includes only a server-confirmed customer identifier passed by the creation flow", () => {
    const values = contactBaseFormSchema.parse({
      name: "张三",
      phoneNumber: "",
      telephone: "",
      jobTitle: "",
      email: "",
      website: "",
      description: "",
      nextContactTime: "",
      addressLine: "",
      addressRegion: "",
      addressCity: "",
      addressPostalCode: "",
      tags: [],
    });

    expect(toContactCreateRequest(values, 8)).toEqual({ name: "张三", customerId: 8 });
  });

  it("keeps catalog-backed custom fields and only server-confirmed CONTACT draft file IDs", () => {
    const values = contactBaseFormSchema.parse({
      name: "张三",
      phoneNumber: "",
      telephone: "",
      jobTitle: "",
      email: "",
      website: "",
      description: "",
      nextContactTime: "",
      addressLine: "",
      addressRegion: "",
      addressCity: "",
      addressPostalCode: "",
      tags: [],
    });

    expect(
      toContactCreateRequest(values, undefined, {
        customFields: { preference: [" 电话 ", "电话", ""] },
        fileFieldSubmission: {
          draftId: 31,
          fields: { credential: [41, 41, 0, -1], empty: [] },
        },
      }),
    ).toEqual({
      name: "张三",
      customFields: { preference: ["电话"] },
      fileFieldDraftId: 31,
      fileFields: { credential: [41] },
    });
  });

  it("includes only an explicitly selected server member as the creation owner", () => {
    const values = contactBaseFormSchema.parse({
      name: "张三",
      phoneNumber: "",
      telephone: "",
      jobTitle: "",
      email: "",
      website: "",
      description: "",
      nextContactTime: "",
      addressLine: "",
      addressRegion: "",
      addressCity: "",
      addressPostalCode: "",
      tags: [],
      ownerActorId: 9,
    });

    expect(toContactCreateRequest(values)).toEqual({ name: "张三", ownerActorId: 9 });
  });

  it("uses only basic visible values for a duplicate check", () => {
    expect(
      toContactDuplicateCheckRequest(
        {
          name: " 张三 ",
          phoneNumber: " +8613812345678 ",
          telephone: "",
          jobTitle: "采购经理",
          email: "",
          website: "",
          description: "",
          nextContactTime: "",
          addressLine: "",
          addressRegion: "",
          addressCity: "",
          addressPostalCode: "",
          tags: [],
        },
        8,
      ),
    ).toEqual({ excludedContactId: 8, name: "张三", phoneNumber: "+8613812345678" });
  });

  it("serializes only changed basic fields with the original optimistic-lock version", () => {
    const baseline = contactBaseFormValuesFromDetail({
      id: 8,
      version: 3,
      name: "张三",
      ownerActorId: null,
      customerId: null,
      parentContactId: null,
      phoneNumber: "+8613812345678",
      telephone: null,
      jobTitle: "采购经理",
      email: null,
      website: null,
      description: "旧说明",
      nextContactTime: "2026-07-25T09:30:00",
      status: null,
      locked: false,
      starred: false,
      dealStatus: null,
      fileFields: [],
      addresses: [],
      tags: [],
      createdTime: null,
      updatedTime: null,
    });

    expect(baseline.nextContactTime).toBe("2026-07-25T09:30");
    expect(toContactUpdateRequest({ ...baseline, description: "" }, baseline, 3)).toEqual({
      version: 3,
      description: "",
    });
    expect(toContactUpdateRequest({ ...baseline, nextContactTime: "" }, baseline, 3)).toEqual({
      version: 3,
      nextContactTime: null,
    });
    expect(toContactUpdateRequest(baseline, baseline, 3)).toEqual({ version: 3 });
  });

  it("rejects a regional address fragment without a detail line", () => {
    expect(
      contactBaseFormSchema.safeParse({
        name: "张三",
        phoneNumber: "",
        telephone: "",
        jobTitle: "",
        email: "",
        website: "",
        description: "",
        nextContactTime: "",
        addressLine: "",
        addressRegion: "上海市",
        addressCity: "",
        addressPostalCode: "",
        tags: [],
      }).success,
    ).toBe(false);
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
      toContactCustomFieldUpdateRequest(definitions, {
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
