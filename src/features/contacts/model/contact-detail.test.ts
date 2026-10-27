import { describe, expect, it } from "vitest";

import { toContactDetail } from "./contact-detail";

describe("toContactDetail", () => {
  it("keeps only supported, server-returned contact fields", () => {
    expect(
      toContactDetail({
        id: 8,
        version: 3,
        name: "张三",
        ownerActorId: 9,
        customerId: 7,
        parentContactId: 6,
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
        tags: ["重点", 7],
        createdTime: "2026-07-25T08:00:00",
        updatedTime: "2026-07-25T09:00:00",
        customFields: { preference: ["电话", 7] },
        addresses: [
          {
            addressLine: "浦东新区世纪大道 1 号",
            region: "上海市",
            city: "上海",
            postalCode: "200120",
            primary: true,
          },
        ],
        fileFields: {
          contact_file: [
            {
              actualBytes: 12,
              displayName: "联系人资料.pdf",
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
      parentContactId: 6,
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
      customFields: { preference: ["电话"] },
      addresses: [
        {
          label: null,
          country: null,
          region: "上海市",
          city: "上海",
          postalCode: "200120",
          addressLine: "浦东新区世纪大道 1 号",
          primary: true,
        },
      ],
      fileFields: [
        {
          attachments: [
            {
              actualBytes: 12,
              displayName: "联系人资料.pdf",
              fileId: 1,
              mediaType: "application/pdf",
            },
          ],
          fieldCode: "contact_file",
        },
      ],
      tags: ["重点"],
      createdTime: "2026-07-25T08:00:00",
      updatedTime: "2026-07-25T09:00:00",
    });
  });

  it("fails closed when the stable identity or version is missing", () => {
    expect(toContactDetail({ id: 8, name: "张三" })).toBeNull();
    expect(toContactDetail({ id: 8, version: 0 })).toBeNull();
  });

  it("drops malformed file fields instead of treating them as attachments", () => {
    expect(
      toContactDetail({ id: 8, fileFields: { broken: [{}] }, name: "张三", version: 0 }),
    ).toMatchObject({ fileFields: [] });
  });

  it("drops malformed address items instead of inventing an address", () => {
    expect(
      toContactDetail({
        id: 8,
        name: "张三",
        version: 0,
        addresses: [{ region: "上海市" }],
      }),
    ).toMatchObject({ addresses: [] });
  });
});
