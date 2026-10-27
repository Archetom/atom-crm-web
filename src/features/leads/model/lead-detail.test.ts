import { describe, expect, it } from "vitest";

import { toLeadDetail } from "./lead-detail";

describe("toLeadDetail", () => {
  it("keeps only supported, server-returned lead fields", () => {
    expect(
      toLeadDetail({
        id: 8,
        version: 3,
        name: "张三",
        ownerActorId: 9,
        customerId: 7,
        convertedContactId: 5,
        parentLeadId: 6,
        phoneNumber: "***1234",
        telephone: "010-12345678",
        jobTitle: "采购经理",
        email: "masked@example.test",
        website: "https://example.test",
        description: "服务端已许可的基础说明",
        nextContactTime: "2026-07-25T09:00:00",
        status: "ACTIVE",
        locked: true,
        starred: true,
        dealStatus: "OPEN",
        addresses: [
          {
            label: "办公地址",
            region: "上海市",
            city: "上海",
            postalCode: "200030",
            addressLine: "虹桥路 1 号",
            primary: true,
          },
          { addressLine: 7 },
        ],
        tags: ["重点", 7],
        createdTime: "2026-07-25T08:00:00",
        updatedTime: "2026-07-25T09:00:00",
        customFields: { source: ["展会", 7] },
        fileFields: {
          lead_file: [
            {
              actualBytes: 12,
              displayName: "线索资料.pdf",
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
      name: "张三",
      ownerActorId: 9,
      customerId: 7,
      convertedContactId: 5,
      parentLeadId: 6,
      phoneNumber: "***1234",
      telephone: "010-12345678",
      jobTitle: "采购经理",
      email: "masked@example.test",
      website: "https://example.test",
      description: "服务端已许可的基础说明",
      nextContactTime: "2026-07-25T09:00:00",
      status: "ACTIVE",
      locked: true,
      starred: true,
      dealStatus: "OPEN",
      addresses: [
        {
          label: "办公地址",
          country: null,
          region: "上海市",
          city: "上海",
          postalCode: "200030",
          addressLine: "虹桥路 1 号",
          primary: true,
        },
      ],
      customFields: { source: ["展会"] },
      fileFields: [
        {
          attachments: [
            {
              actualBytes: 12,
              displayName: "线索资料.pdf",
              fileId: 1,
              mediaType: "application/pdf",
            },
          ],
          fieldCode: "lead_file",
        },
      ],
      tags: ["重点"],
      createdTime: "2026-07-25T08:00:00",
      updatedTime: "2026-07-25T09:00:00",
    });
  });

  it("fails closed when the stable identity or version is missing", () => {
    expect(toLeadDetail({ id: 8, name: "张三" })).toBeNull();
    expect(toLeadDetail({ id: 8, version: 0 })).toBeNull();
  });

  it("drops malformed file fields instead of treating them as attachments", () => {
    expect(
      toLeadDetail({ id: 8, fileFields: { broken: [{}] }, name: "张三", version: 0 }),
    ).toMatchObject({ fileFields: [] });
  });
});
