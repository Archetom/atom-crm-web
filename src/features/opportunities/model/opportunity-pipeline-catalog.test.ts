import { describe, expect, it } from "vitest";

import {
  toOpportunityPipelineCatalogItem,
  toOpportunityPipelineStageCatalogItem,
} from "./opportunity-pipeline-catalog";

describe("opportunity pipeline catalog", () => {
  it("keeps only a complete pipeline version baseline", () => {
    expect(
      toOpportunityPipelineCatalogItem({
        code: "direct",
        displayOrder: 10,
        id: 3,
        name: "直销",
        status: "ACTIVE",
        version: 4,
      }),
    ).toEqual({
      code: "direct",
      displayOrder: 10,
      id: 3,
      name: "直销",
      status: "ACTIVE",
      version: 4,
    });
  });

  it("rejects incomplete pipeline and stage mutation baselines", () => {
    expect(
      toOpportunityPipelineCatalogItem({
        code: "direct",
        displayOrder: 10,
        id: 3,
        name: "直销",
        status: "ACTIVE",
      }),
    ).toBeNull();
    expect(
      toOpportunityPipelineStageCatalogItem({
        code: "discovery",
        displayOrder: 10,
        id: 8,
        name: "发现需求",
        pipelineCode: "direct",
        probability: 101,
        status: "ACTIVE",
        version: 4,
      }),
    ).toBeNull();
  });
});
