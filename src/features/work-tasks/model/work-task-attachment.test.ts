import { describe, expect, it } from "vitest";

import { toWorkTaskAttachment } from "./work-task-attachment";

describe("toWorkTaskAttachment", () => {
  it("keeps only the task attachment browse projection", () => {
    expect(
      toWorkTaskAttachment({
        actualBytes: 2048,
        availableTime: "2026-07-26T12:00:00",
        createdTime: "2026-07-26T10:00:00",
        displayName: "任务说明.pdf",
        fileId: 7,
        mediaType: "application/pdf",
        uploaderActorId: 9,
        version: 3,
      }),
    ).toEqual({
      displayName: "任务说明.pdf",
      fileId: 7,
      mediaType: "application/pdf",
      version: 3,
    });
  });

  it("fails closed without a stable attachment identity, name, and version", () => {
    expect(toWorkTaskAttachment({ displayName: "任务说明.pdf", fileId: 7 })).toBeNull();
    expect(toWorkTaskAttachment({ displayName: "", fileId: 7, version: 0 })).toBeNull();
    expect(toWorkTaskAttachment({ displayName: "任务说明.pdf", fileId: 0, version: 0 })).toBeNull();
  });
});
