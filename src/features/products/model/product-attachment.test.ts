import { describe, expect, it } from "vitest";

import { formatProductAttachmentSize, toProductAttachments } from "./product-attachment";

describe("toProductAttachments", () => {
  it("keeps only valid controlled attachment metadata", () => {
    expect(
      toProductAttachments([
        {
          actualBytes: 1040,
          displayName: " catalog.png ",
          fileId: 12,
          mediaType: " image/png ",
          version: 3,
        },
        { fileId: 0, version: 1 },
        { actualBytes: -1, fileId: 13, version: -1 },
      ]),
    ).toEqual([
      {
        actualBytes: 1040,
        displayName: "catalog.png",
        fileId: 12,
        mediaType: "image/png",
        version: 3,
      },
      {
        actualBytes: null,
        displayName: "附件 #13",
        fileId: 13,
        mediaType: null,
        version: null,
      },
    ]);
  });
});

describe("formatProductAttachmentSize", () => {
  it("formats server-provided byte sizes without deriving a size", () => {
    expect(formatProductAttachmentSize(null)).toBe("大小未提供");
    expect(formatProductAttachmentSize(12)).toBe("12 B");
    expect(formatProductAttachmentSize(1024)).toBe("1.0 KB");
    expect(formatProductAttachmentSize(1024 * 1024)).toBe("1.0 MB");
  });
});
