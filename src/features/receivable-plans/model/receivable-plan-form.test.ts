import { describe, expect, it } from "vitest";

import {
  toReceivablePlanBatchCreateRequest,
  toReceivablePlanCreateRequest,
  toReceivablePlanCustomFieldUpdateRequest,
  toReceivablePlanCustomFieldUpdateValues,
  toReceivablePlanDueDateUpdateRequest,
} from "./receivable-plan-form";
import type { FieldDefinition } from "~/components/dynamic-field";

describe("toReceivablePlanCreateRequest", () => {
  it("uses the generated create contract with explicit reminder and remark values", () => {
    expect(
      toReceivablePlanCreateRequest({
        contractId: 8,
        dueDate: "2026-08-26",
        paymentMethod: " TRANSFER ",
        plannedAmount: 12.34,
        reminderDays: 7,
        remark: " 首期提醒 ",
      }),
    ).toEqual({
      contractId: 8,
      dueDate: "2026-08-26",
      paymentMethod: "TRANSFER",
      plannedAmount: 12.34,
      reminderDays: 7,
      remark: "首期提醒",
    });
  });

  it("omits a blank optional remark", () => {
    expect(
      toReceivablePlanCreateRequest({
        contractId: 8,
        dueDate: "2026-08-26",
        paymentMethod: "TRANSFER",
        plannedAmount: 12.34,
        reminderDays: 0,
        remark: "  ",
      }),
    ).not.toHaveProperty("remark");
  });

  it("omits an untouched optional reminder", () => {
    expect(
      toReceivablePlanCreateRequest({
        contractId: 8,
        dueDate: "2026-08-26",
        paymentMethod: "TRANSFER",
        plannedAmount: 12.34,
      }),
    ).not.toHaveProperty("reminderDays");
  });

  it("serializes catalog values and files from the same RECEIVABLE_PLAN draft only", () => {
    expect(
      toReceivablePlanCreateRequest({
        contractId: 8,
        customFields: { phase: ["  initial ", "initial", ""] },
        dueDate: "2026-08-26",
        fileFieldSubmission: {
          draftId: 31,
          fields: { schedule: [14, 14, 0] },
        },
        paymentMethod: "TRANSFER",
        plannedAmount: 12.34,
        reminderDays: 0,
      }),
    ).toEqual({
      contractId: 8,
      customFields: { phase: ["initial"] },
      dueDate: "2026-08-26",
      fileFieldDraftId: 31,
      fileFields: { schedule: [14] },
      paymentMethod: "TRANSFER",
      plannedAmount: 12.34,
      reminderDays: 0,
    });
  });

  it("preserves each batch row's catalog values, explicit reminder, and normalized remark", () => {
    expect(
      toReceivablePlanBatchCreateRequest(8, [
        {
          customFields: { phase: [" first ", "first", ""] },
          dueDate: "2026-08-26",
          paymentMethod: " TRANSFER ",
          plannedAmount: 12.34,
          reminderDays: 3,
          remark: " 第一笔 ",
        },
        {
          customFields: { region: [" east ", "east"] },
          dueDate: "2026-09-26",
          paymentMethod: "CASH",
          plannedAmount: 56.78,
          remark: " ",
        },
      ]),
    ).toEqual({
      contractId: 8,
      plans: [
        {
          customFields: { phase: ["first"] },
          dueDate: "2026-08-26",
          paymentMethod: "TRANSFER",
          plannedAmount: 12.34,
          reminderDays: 3,
          remark: "第一笔",
        },
        {
          customFields: { region: ["east"] },
          dueDate: "2026-09-26",
          paymentMethod: "CASH",
          plannedAmount: 56.78,
        },
      ],
    });
  });

  it("submits only a changed due date with the current version", () => {
    expect(
      toReceivablePlanDueDateUpdateRequest({
        dueDate: " 2026-09-26 ",
        originalDueDate: "2026-08-26",
        version: 3,
      }),
    ).toEqual({ dueDate: "2026-09-26", version: 3 });
  });

  it("merges only explicit catalog-backed custom-field changes", () => {
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
    const changedCodes = new Set(["channel", "tier", "unknown"]);

    expect(
      toReceivablePlanCustomFieldUpdateValues(
        definitions,
        { channel: [" offline "] },
        changedCodes,
      ),
    ).toEqual({ channel: ["offline"], tier: [] });
    expect(
      toReceivablePlanCustomFieldUpdateRequest(
        definitions,
        { channel: [" offline "] },
        changedCodes,
        6,
      ),
    ).toEqual({ customFields: { channel: ["offline"], tier: [] }, version: 6 });
  });
});
