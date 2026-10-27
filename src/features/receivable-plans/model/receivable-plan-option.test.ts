import { describe, expect, it } from "vitest";

import {
  decodeReceivablePlanOptions,
  toReceivablePlanOption,
  toReceivablePlanSelectionItem,
} from "./receivable-plan-option";

describe("receivable-plan relation options", () => {
  it("uses only the stable plan identity and installment for a selector label", () => {
    expect(
      toReceivablePlanOption({
        contractId: null,
        customerId: 4,
        dueDate: "2026-09-01",
        fileFields: [],
        id: 8,
        installment: 2,
        ownerActorId: null,
        paymentMethod: null,
        plannedAmount: null,
        progress: "PENDING",
        receivedAmount: null,
        remainingAmount: null,
        reminderDays: null,
        remark: null,
        status: "ACTIVE",
        createdTime: null,
        updatedTime: null,
        version: 0,
      }),
    ).toEqual({ id: 8, name: "第 2 期" });
  });

  it("rejects malformed query rows and deduplicates a plan ID", () => {
    expect(
      decodeReceivablePlanOptions({
        objectList: [
          { customerId: 4, id: 8, installment: 2, version: 0 },
          { customerId: 4, id: 8, installment: 3, version: 0 },
          { customerId: 4, id: 0, version: 0 },
        ],
      }),
    ).toEqual([{ id: 8, name: "第 2 期" }]);
  });

  it("drops financial fields before a receivable form retains an available plan", () => {
    expect(
      toReceivablePlanSelectionItem({
        contractId: 7,
        customerId: 4,
        dueDate: "2026-09-01",
        fileFields: [],
        id: 8,
        installment: 2,
        ownerActorId: 5,
        paymentMethod: "TRANSFER",
        plannedAmount: 99,
        progress: "PENDING",
        receivedAmount: 22,
        remainingAmount: 77,
        reminderDays: 3,
        remark: "sensitive",
        status: "ACTIVE",
        createdTime: "2026-08-01T00:00:00Z",
        updatedTime: "2026-08-02T00:00:00Z",
        version: 0,
      }),
    ).toEqual({
      contractId: 7,
      customerId: 4,
      dueDate: "2026-09-01",
      id: 8,
      installment: 2,
      progress: "PENDING",
      status: "ACTIVE",
      version: 0,
    });
  });
});
