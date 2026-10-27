import { describe, expect, it } from "vitest";

import {
  toApprovalRoutePreview,
  toApprovalStartCandidatePage,
  toApprovalStartOptions,
} from "./approval-start";

describe("approval start projections", () => {
  it("keeps only server-authorized definition choices and explicit selections", () => {
    expect(
      toApprovalStartOptions({
        objectType: "CUSTOMER",
        options: [
          {
            definitionId: 18,
            name: "客户折扣审批",
            selections: [{ code: "regional-owner", name: "区域负责人" }],
          },
        ],
        subjectId: 8,
      }),
    ).toEqual({
      objectType: "CUSTOMER",
      options: [
        {
          definitionId: 18,
          name: "客户折扣审批",
          selections: [{ code: "regional-owner", name: "区域负责人" }],
        },
      ],
      subjectId: 8,
    });
  });

  it("rejects duplicate selection codes and malformed candidate pages", () => {
    expect(
      toApprovalStartOptions({
        objectType: "CUSTOMER",
        options: [
          {
            definitionId: 18,
            name: "客户折扣审批",
            selections: [
              { code: "regional-owner", name: "区域负责人" },
              { code: "regional-owner", name: "重复" },
            ],
          },
        ],
        subjectId: 8,
      }),
    ).toBeNull();
    expect(toApprovalStartCandidatePage({ objectList: [{ actorId: 3 }], totalNum: 1 })).toBeNull();
  });

  it("keeps only the executable preview fields needed by the start UI", () => {
    expect(
      toApprovalRoutePreview({
        blockerCode: null,
        definitionId: 18,
        executable: true,
        steps: [
          {
            code: "regional-owner",
            name: "区域负责人审批",
            selectionRequired: true,
          },
        ],
        subjectId: 8,
      }),
    ).toEqual({
      blockerCode: null,
      definitionId: 18,
      executable: true,
      steps: [{ name: "区域负责人审批", selectionRequired: true }],
      subjectId: 8,
    });
    expect(
      toApprovalRoutePreview({
        definitionId: 18,
        executable: true,
        steps: [{ name: "区域负责人审批" }],
        subjectId: 8,
      }),
    ).toBeNull();
  });
});
