import { describe, expect, it } from "vitest";

import { toReceivableListItem } from "./receivable-list-item";

describe("toReceivableListItem", () => {
  it("keeps the latest server-projected approval state separate from the record state", () => {
    expect(
      toReceivableListItem({
        approvalStatus: "PENDING",
        customFields: { channel: ["offline"] },
        customerId: 4,
        fileFields: {
          receipt_file: [{ actualBytes: 4, displayName: "收据.pdf", fileId: 12, mediaType: null }],
        },
        id: 8,
        status: "ACTIVE",
        version: 3,
      }),
    ).toEqual({
      amount: null,
      approvalStatus: "PENDING",
      contractId: null,
      createdTime: null,
      customFields: { channel: ["offline"] },
      customerId: 4,
      fileFields: [
        {
          attachments: [
            {
              actualBytes: 4,
              displayName: "收据.pdf",
              fileId: 12,
              mediaType: null,
            },
          ],
          fieldCode: "receipt_file",
        },
      ],
      id: 8,
      ownerActorId: null,
      paymentMethod: null,
      receivablePlanId: null,
      receiptNumber: null,
      receivedDate: null,
      remark: null,
      status: "ACTIVE",
      updatedTime: null,
      version: 3,
    });
  });

  it("drops unrecognized approval states without changing the business record projection", () => {
    expect(
      toReceivableListItem({
        approvalStatus: "ACTIVE",
        customerId: 4,
        id: 8,
        version: 0,
      }),
    ).toMatchObject({ approvalStatus: null, customerId: 4, id: 8, version: 0 });
  });
});
