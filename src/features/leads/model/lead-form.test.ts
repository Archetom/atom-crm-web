import { describe, expect, it } from "vitest";

import {
  leadBaseFormSchema,
  leadBaseFormValuesFromDetail,
  toLeadCreateRequest,
  toLeadCustomFieldUpdateRequest,
  toLeadDuplicateCheckRequest,
  toLeadUpdateRequest,
} from "./lead-form";
import type { FieldDefinition } from "~/components/dynamic-field";

describe("lead base form", () => {
  it("serializes only explicitly provided basic values for creation", () => {
    const values = leadBaseFormSchema.parse({
      name: "  张三  ",
      phoneNumber: "  +8613812345678 ",
      telephone: "",
      jobTitle: "  采购经理 ",
      email: "  buyer@example.test ",
      website: "",
      description: "  重点线索 ",
      nextContactTime: "2026-07-25T09:30",
      addressLine: "  虹桥路 1 号  ",
      addressRegion: "  上海市  ",
      addressCity: "  上海  ",
      addressPostalCode: "  200030  ",
      tags: ["  重点  ", "华东"],
    });

    expect(toLeadCreateRequest(values)).toEqual({
      name: "张三",
      phoneNumber: "+8613812345678",
      jobTitle: "采购经理",
      email: "buyer@example.test",
      description: "重点线索",
      nextContactTime: "2026-07-25T09:30",
      addresses: [
        {
          addressLine: "虹桥路 1 号",
          region: "上海市",
          city: "上海",
          postalCode: "200030",
          primary: true,
        },
      ],
      tags: ["重点", "华东"],
    });
  });

  it("rejects a phone number without an E.164 country prefix", () => {
    expect(
      leadBaseFormSchema.safeParse({
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

  it("includes only an explicitly selected server member as the creation owner", () => {
    const values = leadBaseFormSchema.parse({
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

    expect(toLeadCreateRequest(values)).toEqual({ name: "张三", ownerActorId: 9 });
  });

  it("includes only a positive server-confirmed customer ID for creation", () => {
    const values = leadBaseFormSchema.parse({
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

    expect(toLeadCreateRequest(values, 8)).toEqual({ name: "张三", customerId: 8 });
    expect(toLeadCreateRequest(values, 0)).toEqual({ name: "张三" });
  });

  it("keeps catalog-backed custom fields and only server-confirmed LEAD draft file IDs", () => {
    const values = leadBaseFormSchema.parse({
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
      toLeadCreateRequest(values, undefined, {
        customFields: { source: [" 展会 ", "展会", ""] },
        fileFieldSubmission: {
          draftId: 31,
          fields: { credential: [41, 41, 0, -1], empty: [] },
        },
      }),
    ).toEqual({
      name: "张三",
      customFields: { source: ["展会"] },
      fileFieldDraftId: 31,
      fileFields: { credential: [41] },
    });
  });

  it("uses only basic visible values for a duplicate check", () => {
    expect(
      toLeadDuplicateCheckRequest(
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
    ).toEqual({ excludedLeadId: 8, name: "张三", phoneNumber: "+8613812345678" });
  });

  it("serializes only changed basic fields with the original optimistic-lock version", () => {
    const baseline = leadBaseFormValuesFromDetail({
      id: 8,
      version: 3,
      name: "张三",
      ownerActorId: null,
      customerId: null,
      convertedContactId: null,
      parentLeadId: null,
      phoneNumber: "+8613812345678",
      telephone: null,
      jobTitle: "采购经理",
      email: null,
      website: null,
      description: "旧说明",
      nextContactTime: "2026-07-25T09:30:00",
      addresses: [],
      status: null,
      locked: false,
      starred: false,
      dealStatus: null,
      fileFields: [],
      tags: [],
      createdTime: null,
      updatedTime: null,
    });

    expect(baseline.nextContactTime).toBe("2026-07-25T09:30");
    expect(toLeadUpdateRequest({ ...baseline, description: "" }, baseline, 3)).toEqual({
      version: 3,
      description: "",
    });
    expect(toLeadUpdateRequest({ ...baseline, nextContactTime: "" }, baseline, 3)).toEqual({
      version: 3,
      nextContactTime: null,
    });
    expect(toLeadUpdateRequest(baseline, baseline, 3)).toEqual({ version: 3 });
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
      toLeadCustomFieldUpdateRequest(definitions, {
        changedCodes: new Set(["source", "tier", "unknown"]),
        customFields: { source: [" renewal "] },
        version: 7,
      }),
    ).toEqual({
      customFields: { source: ["renewal"], tier: [] },
      version: 7,
    });
  });

  it("requires a detail address before accepting regional fragments", () => {
    expect(
      leadBaseFormSchema.safeParse({
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
});
