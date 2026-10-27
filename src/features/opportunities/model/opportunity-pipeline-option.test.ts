import { describe, expect, it } from "vitest";

import {
  decodeOpportunityPipelineOptions,
  decodeOpportunityPipelineStageOptions,
} from "./opportunity-pipeline-option";

describe("opportunity pipeline options", () => {
  it("keeps only active stable pipeline choices", () => {
    expect(
      decodeOpportunityPipelineOptions({
        objectList: [
          { code: "direct", id: 3, name: "直销", status: "ACTIVE" },
          { code: "archived", id: 4, name: "归档", status: "INACTIVE" },
          { code: "bad", id: 0, name: "无效", status: "ACTIVE" },
        ],
      }),
    ).toEqual([{ code: "direct", id: 3, name: "直销" }]);
  });

  it("keeps only active stable stage choices", () => {
    expect(
      decodeOpportunityPipelineStageOptions({
        objectList: [
          { code: "discovery", id: 7, name: "发现", status: "ACTIVE" },
          { code: "draft", id: 8, name: "草稿", status: "INACTIVE" },
        ],
      }),
    ).toEqual([{ code: "discovery", id: 7, name: "发现" }]);
  });

  it("rejects an invalid catalog envelope", () => {
    expect(() => decodeOpportunityPipelineOptions({})).toThrow("销售管线目录数据暂时不可用");
  });
});
