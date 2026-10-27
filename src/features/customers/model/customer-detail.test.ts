import { describe, expect, it } from "vitest";

import { toCustomerDetail } from "./customer-detail";

describe("toCustomerDetail", () => {
  it("keeps supported base fields, server-projected custom values, and controlled FILE metadata", () => {
    expect(
      toCustomerDetail({
        id: 7,
        version: 3,
        name: "Acme",
        ownerActorId: 9,
        parentCustomerId: 3,
        phoneNumber: "***1234",
        telephone: "010-12345678",
        email: "masked@example.test",
        website: "https://example.test",
        description: "服务端已许可的基础说明",
        status: "ACTIVE",
        locked: true,
        starred: true,
        dealStatus: "DEALING",
        addresses: [
          {
            label: "总部",
            region: "上海市",
            city: "上海",
            postalCode: "200030",
            addressLine: "虹桥路 1 号",
            primary: true,
          },
          { addressLine: 8 },
        ],
        tags: ["重点", "华北", 7],
        createdTime: "2026-07-25T08:00:00",
        updatedTime: "2026-07-25T09:00:00",
        customFields: { secret: ["must not enter the projection"] },
        fileFields: {
          agreement: [
            {
              actualBytes: 24,
              displayName: "客户协议.pdf",
              fileId: 18,
              mediaType: "application/pdf",
            },
          ],
        },
      }),
    ).toEqual({
      id: 7,
      version: 3,
      name: "Acme",
      ownerActorId: 9,
      parentCustomerId: 3,
      phoneNumber: "***1234",
      telephone: "010-12345678",
      email: "masked@example.test",
      website: "https://example.test",
      description: "服务端已许可的基础说明",
      status: "ACTIVE",
      locked: true,
      starred: true,
      dealStatus: "DEALING",
      customFields: { secret: ["must not enter the projection"] },
      fileFields: [
        {
          attachments: [
            {
              actualBytes: 24,
              displayName: "客户协议.pdf",
              fileId: 18,
              mediaType: "application/pdf",
            },
          ],
          fieldCode: "agreement",
        },
      ],
      addresses: [
        {
          label: "总部",
          country: null,
          region: "上海市",
          city: "上海",
          postalCode: "200030",
          addressLine: "虹桥路 1 号",
          primary: true,
        },
      ],
      tags: ["重点", "华北"],
      createdTime: "2026-07-25T08:00:00",
      updatedTime: "2026-07-25T09:00:00",
    });
  });

  it("fails closed when the stable identity is missing", () => {
    expect(toCustomerDetail({ id: 7, version: 0 })).toBeNull();
    expect(toCustomerDetail({ name: "Acme", version: 0 })).toBeNull();
  });

  it("does not invent an unlocked state when the server omits it", () => {
    expect(toCustomerDetail({ id: 7, version: 0, name: "Acme" })?.locked).toBeNull();
  });
});
