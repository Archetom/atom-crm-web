import { describe, expect, it } from "vitest";

import { toWorkTaskFollowerBaseline } from "./work-task-follower-baseline";

describe("toWorkTaskFollowerBaseline", () => {
  it("keeps only the complete follower replacement baseline from an open task", () => {
    expect(
      toWorkTaskFollowerBaseline({
        createdByActorId: 8,
        currentAssigneeActorId: 9,
        followerActorIds: [10, 11],
        id: 6,
        originKind: "MANUAL",
        status: "IN_PROGRESS",
        version: 4,
      }),
    ).toEqual({
      followerActorIds: [10, 11],
      id: 6,
      status: "IN_PROGRESS",
      version: 4,
    });
  });

  it("fails closed for a duplicate, malformed, or closed follower baseline", () => {
    expect(
      toWorkTaskFollowerBaseline({
        followerActorIds: [10, 10],
        id: 6,
        status: "TODO",
        version: 4,
      }),
    ).toBeNull();
    expect(
      toWorkTaskFollowerBaseline({
        followerActorIds: [],
        id: 6,
        status: "DONE",
        version: 4,
      }),
    ).toBeNull();
  });
});
