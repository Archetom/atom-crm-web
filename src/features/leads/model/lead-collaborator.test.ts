import { describe, expect, it } from "vitest";

import { decodeLeadCollaboratorBaseline } from "./lead-collaborator";

describe("decodeLeadCollaboratorBaseline", () => {
  it("keeps only complete, unique collaborator replacement entries", () => {
    expect(
      decodeLeadCollaboratorBaseline({
        version: 3,
        callerState: "OWNER",
        collaborators: [{ actorId: 8, access: "READ" }],
      }),
    ).toEqual({
      version: 3,
      callerState: "OWNER",
      collaborators: [{ actorId: 8, access: "READ" }],
    });
  });

  it("fails closed for malformed baselines or duplicate entries", () => {
    expect(() =>
      decodeLeadCollaboratorBaseline({
        version: 3,
        callerState: "OWNER",
        collaborators: [{ actorId: 8, access: "OWNER" }],
      }),
    ).toThrow("线索协作者数据暂时不可用");
    expect(() =>
      decodeLeadCollaboratorBaseline({
        version: -1,
        callerState: "INVALID",
        collaborators: [
          { actorId: 8, access: "READ" },
          { actorId: 8, access: "WRITE" },
        ],
      }),
    ).toThrow("线索协作者数据暂时不可用");
  });
});
