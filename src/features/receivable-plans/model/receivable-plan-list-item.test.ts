import { describe, expect, it } from "vitest";

import { toReceivablePlanListItem } from "./receivable-plan-list-item";

describe("toReceivablePlanListItem", () => {
  it("keeps only server-returned custom values and controlled field attachments", () => {
    expect(
      toReceivablePlanListItem({
        customFields: { reminder_note: ["monthly"] },
        customerId: 4,
        fileFields: {
          plan_file: [{ actualBytes: 4, displayName: "计划.pdf", fileId: 12, mediaType: null }],
          unknown: [{ fileId: 0 }],
        },
        id: 8,
        version: 3,
      }),
    ).toEqual({
      contractId: null,
      customFields: { reminder_note: ["monthly"] },
      customerId: 4,
      dueDate: null,
      fileFields: [
        {
          attachments: [
            {
              actualBytes: 4,
              displayName: "计划.pdf",
              fileId: 12,
              mediaType: null,
            },
          ],
          fieldCode: "plan_file",
        },
      ],
      id: 8,
      installment: null,
      ownerActorId: null,
      paymentMethod: null,
      plannedAmount: null,
      progress: null,
      receivedAmount: null,
      remainingAmount: null,
      reminderDays: null,
      remark: null,
      status: null,
      createdTime: null,
      updatedTime: null,
      version: 3,
    });
  });

  it("keeps only finite server-returned plan amounts without recomputing them", () => {
    expect(
      toReceivablePlanListItem({
        customerId: null,
        id: 9,
        plannedAmount: 120,
        receivedAmount: 30,
        remainingAmount: 90,
        version: 1,
      }),
    ).toMatchObject({
      customerId: null,
      plannedAmount: 120,
      receivedAmount: 30,
      remainingAmount: 90,
    });
  });
});
