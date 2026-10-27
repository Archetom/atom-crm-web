import { describe, expect, it } from "vitest";

import {
  toReceivableCreateRequest,
  toReceivableCustomFieldUpdateRequest,
  toReceivableCustomFieldUpdateValues,
  toReceivableReceivedDateUpdateRequest,
} from "./receivable-form";
import type { FieldDefinition } from "~/components/dynamic-field";

describe("toReceivableCreateRequest", () => {
  it("uses the generated create contract without plan or operational fields", () => {
    expect(
      toReceivableCreateRequest({
        amount: 12.34,
        contractId: 8,
        paymentMethod: " TRANSFER ",
        receivedDate: "2026-07-26",
      }),
    ).toEqual({
      amount: 12.34,
      contractId: 8,
      paymentMethod: "TRANSFER",
      receivedDate: "2026-07-26",
    });
  });

  it("includes only a selected server-visible receivable-plan identifier", () => {
    expect(
      toReceivableCreateRequest({
        amount: 12.34,
        contractId: 8,
        paymentMethod: "TRANSFER",
        receivablePlanId: 9,
        receivedDate: "2026-07-26",
      }),
    ).toEqual({
      amount: 12.34,
      contractId: 8,
      paymentMethod: "TRANSFER",
      receivablePlanId: 9,
      receivedDate: "2026-07-26",
    });
  });

  it("sends an owner only when explicitly selected from the member directory", () => {
    expect(
      toReceivableCreateRequest({
        amount: 12.34,
        contractId: 8,
        ownerActorId: 9,
        paymentMethod: "TRANSFER",
        receivedDate: "2026-07-26",
      }),
    ).toEqual({
      amount: 12.34,
      contractId: 8,
      ownerActorId: 9,
      paymentMethod: "TRANSFER",
      receivedDate: "2026-07-26",
    });
  });

  it("includes an explicit remark while omitting blank text", () => {
    expect(
      toReceivableCreateRequest({
        amount: 12.34,
        contractId: 8,
        paymentMethod: "TRANSFER",
        receivedDate: "2026-07-26",
        remark: " 本次已到账 ",
      }),
    ).toEqual({
      amount: 12.34,
      contractId: 8,
      paymentMethod: "TRANSFER",
      receivedDate: "2026-07-26",
      remark: "本次已到账",
    });
    expect(
      toReceivableCreateRequest({
        amount: 12.34,
        contractId: 8,
        paymentMethod: "TRANSFER",
        receivedDate: "2026-07-26",
        remark: "  ",
      }),
    ).not.toHaveProperty("remark");
  });

  it("serializes catalog values and files from the same RECEIVABLE draft only", () => {
    expect(
      toReceivableCreateRequest({
        amount: 12.34,
        contractId: 8,
        customFields: { channel: ["  offline ", "offline", ""] },
        fileFieldSubmission: {
          draftId: 21,
          fields: { receipt: [12, 12, -1] },
        },
        paymentMethod: "TRANSFER",
        receivedDate: "2026-07-26",
      }),
    ).toEqual({
      amount: 12.34,
      contractId: 8,
      customFields: { channel: ["offline"] },
      fileFieldDraftId: 21,
      fileFields: { receipt: [12] },
      paymentMethod: "TRANSFER",
      receivedDate: "2026-07-26",
    });
  });

  it("submits only a changed received date with the current version", () => {
    expect(
      toReceivableReceivedDateUpdateRequest({
        originalReceivedDate: "2026-07-26",
        receivedDate: " 2026-08-26 ",
        version: 3,
      }),
    ).toEqual({ receivedDate: "2026-08-26", version: 3 });
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
      toReceivableCustomFieldUpdateValues(definitions, { channel: [" offline "] }, changedCodes),
    ).toEqual({ channel: ["offline"], tier: [] });
    expect(
      toReceivableCustomFieldUpdateRequest(
        definitions,
        { channel: [" offline "] },
        changedCodes,
        3,
      ),
    ).toEqual({ customFields: { channel: ["offline"], tier: [] }, version: 3 });
  });
});
