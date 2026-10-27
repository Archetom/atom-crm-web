import { describe, expect, it } from "vitest";

import { decodeControlledFileFields, formatControlledFileFieldSize } from "./model";

describe("decodeControlledFileFields", () => {
  it("keeps only valid server-projected field codes and attachment metadata", () => {
    expect(
      decodeControlledFileFields({
        specification: [
          {
            actualBytes: 24,
            displayName: " specification.pdf ",
            fileId: 8,
            mediaType: " application/pdf ",
          },
          { fileId: "9" },
        ],
        "unsafe-code": [{ fileId: 10 }],
        empty: [],
      }),
    ).toEqual([
      {
        attachments: [
          {
            actualBytes: 24,
            displayName: "specification.pdf",
            fileId: 8,
            mediaType: "application/pdf",
          },
        ],
        fieldCode: "specification",
      },
    ]);
  });
});

describe("formatControlledFileFieldSize", () => {
  it("formats only a server-provided size", () => {
    expect(formatControlledFileFieldSize(null)).toBe("大小未提供");
    expect(formatControlledFileFieldSize(12)).toBe("12 B");
    expect(formatControlledFileFieldSize(1024)).toBe("1.0 KB");
  });
});
