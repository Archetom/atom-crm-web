import { describe, expect, it } from "vitest";

import { decodeOpportunityOptions, toOpportunityOption } from "./opportunity-option";

describe("opportunity relation options", () => {
  it("uses only stable opportunity identity and name for a selector", () => {
    expect(
      toOpportunityOption({
        customerId: null,
        description: null,
        estimatedAmount: null,
        expectedCloseDate: null,
        id: 8,
        lastActivityTime: null,
        name: "续约商机",
        nextContactTime: null,
        outcome: null,
        ownerActorId: null,
        pipelineCode: null,
        stageCode: null,
        starred: false,
        status: "OPEN",
      }),
    ).toEqual({ id: 8, name: "续约商机" });
  });

  it("rejects malformed query rows and deduplicates an opportunity ID", () => {
    expect(
      decodeOpportunityOptions({
        objectList: [
          { id: 8, name: "续约商机" },
          { id: 8, name: "重复商机" },
          { id: 0, name: "无效商机" },
        ],
      }),
    ).toEqual([{ id: 8, name: "续约商机" }]);
  });
});
