import { describe, expect, it } from "vitest";

import {
  isStageWorkflowCommentDeleted,
  toStageWorkflowCommentPage,
} from "./stage-workflow-comment";

describe("stage workflow comment projections", () => {
  it("keeps the record-bound deletion baseline and drops author data", () => {
    expect(
      toStageWorkflowCommentPage({
        objectList: [
          {
            authorId: 99,
            canDelete: true,
            content: "已确认客户资料齐全。",
            createdTime: "2026-07-28T15:00:00",
            id: 12,
            updatedTime: "2026-07-28T16:00:00",
            version: 3,
            workflowRecordId: 71,
          },
        ],
        totalNum: 1,
      }),
    ).toEqual({
      items: [
        {
          canDelete: true,
          content: "已确认客户资料齐全。",
          createdTime: "2026-07-28T15:00:00",
          id: 12,
          version: 3,
          workflowRecordId: 71,
        },
      ],
      total: 1,
    });
  });

  it("fails closed without a deletion version or a valid page item and verifies exact delete acknowledgements", () => {
    expect(
      toStageWorkflowCommentPage({
        objectList: [
          {
            canDelete: true,
            content: "评论",
            id: 12,
            workflowRecordId: 71,
          },
        ],
      }),
    ).toBeNull();
    expect(isStageWorkflowCommentDeleted({ deleted: true, id: 12 }, 12)).toBe(true);
    expect(isStageWorkflowCommentDeleted({ deleted: true, id: 13 }, 12)).toBe(false);
  });
});
