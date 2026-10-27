import { describe, expect, it } from "vitest";

import { toOpportunityDetail } from "./opportunity-detail";

describe("toOpportunityDetail", () => {
  it("keeps only the supported, server-returned opportunity projection", () => {
    expect(
      toOpportunityDetail({
        id: 8,
        version: 3,
        name: "年度续约",
        ownerActorId: 9,
        customerId: 7,
        pipelineCode: "direct",
        stageCode: "proposal",
        expectedCloseDate: "2026-08-01",
        nextContactTime: "2026-07-30T09:00:00",
        description: "服务端已许可的基础说明",
        outcome: "OPEN",
        outcomeTime: "2026-07-25T09:00:00",
        outcomeRemark: "持续跟进",
        status: "ACTIVE",
        starred: true,
        createdTime: "2026-07-25T08:00:00",
        updatedTime: "2026-07-25T09:00:00",
        estimatedAmount: 99999,
        contactIds: [1],
        collaborators: [{ actorId: 2 }],
        customFields: { source: ["展会", 7] },
        fileFields: {
          opportunity_file: [
            {
              actualBytes: 12,
              displayName: "商机资料.pdf",
              fileId: 1,
              mediaType: "application/pdf",
            },
          ],
          ignored: [{ fileId: 0 }],
        },
      }),
    ).toEqual({
      id: 8,
      version: 3,
      name: "年度续约",
      ownerActorId: 9,
      customerId: 7,
      pipelineCode: "direct",
      stageCode: "proposal",
      expectedCloseDate: "2026-08-01",
      estimatedAmount: 99999,
      nextContactTime: "2026-07-30T09:00:00",
      description: "服务端已许可的基础说明",
      outcome: "OPEN",
      outcomeTime: "2026-07-25T09:00:00",
      outcomeRemark: "持续跟进",
      status: "ACTIVE",
      starred: true,
      customFields: { source: ["展会"] },
      fileFields: [
        {
          attachments: [
            {
              actualBytes: 12,
              displayName: "商机资料.pdf",
              fileId: 1,
              mediaType: "application/pdf",
            },
          ],
          fieldCode: "opportunity_file",
        },
      ],
      createdTime: "2026-07-25T08:00:00",
      updatedTime: "2026-07-25T09:00:00",
    });
  });

  it("fails closed when the stable identity or version is missing", () => {
    expect(toOpportunityDetail({ id: 8, name: "年度续约" })).toBeNull();
    expect(toOpportunityDetail({ id: 8, version: 0 })).toBeNull();
  });

  it("drops malformed file fields instead of treating them as attachments", () => {
    expect(
      toOpportunityDetail({ id: 8, fileFields: { broken: [{}] }, name: "年度续约", version: 0 }),
    ).toMatchObject({ fileFields: [] });
  });
});
