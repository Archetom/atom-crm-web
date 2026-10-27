import { describe, expect, it } from "vitest";

import { toReturnVisitDetail } from "./return-visit-detail";

describe("toReturnVisitDetail", () => {
  it("requires a stable return-visit baseline and an unmasked customer relation", () => {
    expect(
      toReturnVisitDetail({
        customerId: 6,
        customFields: { cf_channel: ["phone"] },
        fileFields: {
          visit_summary: [
            {
              actualBytes: 24,
              displayName: "回访记录.pdf",
              fileId: 18,
              mediaType: "application/pdf",
            },
          ],
        },
        id: 8,
        remark: "确认回访安排",
        version: 3,
        visitTime: "2026-07-25T09:00:00",
      }),
    ).toMatchObject({
      customerId: 6,
      customFields: { cf_channel: ["phone"] },
      fileFields: [
        {
          attachments: [
            {
              actualBytes: 24,
              displayName: "回访记录.pdf",
              fileId: 18,
              mediaType: "application/pdf",
            },
          ],
          fieldCode: "visit_summary",
        },
      ],
      id: 8,
      version: 3,
    });
  });

  it("fails closed when the customer relation is unavailable", () => {
    expect(toReturnVisitDetail({ customerId: null, id: 8, version: 3 })).toBeNull();
  });
});
