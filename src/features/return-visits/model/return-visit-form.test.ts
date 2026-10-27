import { describe, expect, it } from "vitest";

import {
  toReturnVisitCreateRequest,
  toReturnVisitCustomFieldUpdateRequest,
  toReturnVisitRelationUpdateRequest,
  toReturnVisitUpdateRequest,
} from "./return-visit-form";
import type { FieldDefinition } from "~/components/dynamic-field";

describe("toReturnVisitCreateRequest", () => {
  it("sends the current customer, explicit basic fields, and selected relations", () => {
    expect(
      toReturnVisitCreateRequest({
        customerId: 6,
        contactId: 8,
        contractId: 9,
        ownerActorId: 10,
        visitForm: "PHONE",
        satisfaction: "SATISFIED",
        remark: "  确认回访安排  ",
        visitTime: "2026-07-25T09:00:00",
      }),
    ).toEqual({
      customerId: 6,
      contactId: 8,
      contractId: 9,
      ownerActorId: 10,
      visitForm: "PHONE",
      satisfaction: "SATISFIED",
      remark: "确认回访安排",
      visitTime: "2026-07-25T09:00:00",
    });
  });

  it("omits an empty optional remark instead of treating it as an update", () => {
    expect(
      toReturnVisitCreateRequest({ customerId: 6, remark: "  ", visitTime: "2026-07-25T09:00:00" }),
    ).toEqual({ customerId: 6, visitTime: "2026-07-25T09:00:00" });
  });

  it("serializes catalog values and files from the same RETURN_VISIT draft only", () => {
    expect(
      toReturnVisitCreateRequest({
        customerId: 6,
        customFields: { channel: ["  phone ", "phone", ""] },
        fileFieldSubmission: { draftId: 41, fields: { note: [15, 15, 0] } },
        visitTime: "2026-07-25T09:00:00",
      }),
    ).toEqual({
      customerId: 6,
      customFields: { channel: ["phone"] },
      fileFieldDraftId: 41,
      fileFields: { note: [15] },
      visitTime: "2026-07-25T09:00:00",
    });
  });

  it("updates only explicit basic fields and leaves relations omitted for the server to retain", () => {
    expect(
      toReturnVisitUpdateRequest({
        baselineRemark: "原始备注  ",
        remark: "原始备注  ",
        version: 3,
        visitTime: "2026-07-25T10:00:00.123456789",
      }),
    ).toEqual({
      remark: "原始备注  ",
      version: 3,
      visitTime: "2026-07-25T10:00:00.123456789",
    });
  });

  it("clears a changed remark without synthesizing relationship fields", () => {
    expect(
      toReturnVisitUpdateRequest({
        baselineRemark: "原始备注",
        remark: "  ",
        version: 3,
        visitTime: "2026-07-25T10:00:00",
      }),
    ).toEqual({ remark: "", version: 3, visitTime: "2026-07-25T10:00:00" });
  });

  it("sends changed return-visit form values and preserves unchanged values", () => {
    expect(
      toReturnVisitUpdateRequest({
        baselineRemark: "原始反馈",
        baselineSatisfaction: "SATISFIED",
        baselineVisitForm: "PHONE",
        remark: "原始反馈",
        satisfaction: "VERY_SATISFIED",
        version: 3,
        visitForm: "PHONE",
        visitTime: "2026-07-25T10:00:00",
      }),
    ).toEqual({
      remark: "原始反馈",
      satisfaction: "VERY_SATISFIED",
      version: 3,
      visitTime: "2026-07-25T10:00:00",
    });
  });

  it("clears a selected return-visit field only when the user changes it", () => {
    expect(
      toReturnVisitUpdateRequest({
        baselineRemark: "原始反馈",
        baselineSatisfaction: "SATISFIED",
        baselineVisitForm: "PHONE",
        remark: "原始反馈",
        satisfaction: "SATISFIED",
        version: 3,
        visitForm: null,
        visitTime: "2026-07-25T10:00:00",
      }),
    ).toEqual({
      remark: "原始反馈",
      version: 3,
      visitForm: null,
      visitTime: "2026-07-25T10:00:00",
    });
  });

  it("sets exactly one selected relation through the generated update contract", () => {
    expect(
      toReturnVisitRelationUpdateRequest({
        baselineRemark: "原始备注",
        relation: "contact",
        relationId: 9,
        remark: "原始备注",
        version: 3,
        visitTime: "2026-07-25T10:00:00",
      }),
    ).toEqual({
      contactId: 9,
      remark: "原始备注",
      version: 3,
      visitTime: "2026-07-25T10:00:00",
    });
  });

  it("clears exactly one relation without overwriting the other relation", () => {
    expect(
      toReturnVisitRelationUpdateRequest({
        baselineRemark: "原始备注",
        relation: "contract",
        relationId: null,
        remark: "原始备注",
        version: 3,
        visitTime: "2026-07-25T10:00:00",
      }),
    ).toEqual({
      contractId: null,
      remark: "原始备注",
      version: 3,
      visitTime: "2026-07-25T10:00:00",
    });
  });

  it("merges only explicit dynamic-field changes while retaining the safe update baseline", () => {
    const definitions: readonly FieldDefinition[] = [
      {
        builtin: false,
        code: "channel",
        displayName: "渠道",
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
      toReturnVisitCustomFieldUpdateRequest(definitions, {
        baselineRemark: "安全基线",
        changedCodes: new Set(["channel", "tier", "unknown"]),
        customFields: { channel: [" phone "] },
        version: 3,
        visitTime: "2026-07-25T10:00:00",
      }),
    ).toEqual({
      customFields: { channel: ["phone"], tier: [] },
      remark: "安全基线",
      version: 3,
      visitTime: "2026-07-25T10:00:00",
    });
  });
});
