import { describe, expect, it } from "vitest";

import { batchTagValidationError, parseBatchTagChange } from "./batch-tag-change";

describe("batch tag change", () => {
  it("splits comma and newline separated values while preserving the server-owned display value", () => {
    expect(parseBatchTagChange(" 重点客户,重点客户\n待跟进 ", "停用")).toEqual({
      addedTags: ["重点客户", "待跟进"],
      removedTags: ["停用"],
    });
  });

  it("rejects an empty or contradictory change before issuing a batch mutation", () => {
    expect(batchTagValidationError(parseBatchTagChange("", ""))).toBe(
      "请至少填写一个要添加或移除的标签。",
    );
    expect(batchTagValidationError(parseBatchTagChange("重点客户", "重点客户"))).toBe(
      "同一标签不能同时添加和移除。",
    );
  });
});
