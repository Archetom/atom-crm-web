import { describe, expect, it } from "vitest";

import { decodeContactCollaboratorBaseline } from "./contact-collaborator";

describe("decodeContactCollaboratorBaseline", () => {
  it("keeps the server-provided replacement baseline", () => {
    expect(
      decodeContactCollaboratorBaseline({
        version: 3,
        callerState: "OWNER",
        collaborators: [
          { actorId: 7, access: "READ" },
          { actorId: 9, access: "WRITE" },
        ],
      }),
    ).toEqual({
      version: 3,
      callerState: "OWNER",
      collaborators: [
        { actorId: 7, access: "READ" },
        { actorId: 9, access: "WRITE" },
      ],
    });
  });

  it("rejects malformed entries instead of dropping them before a full replacement", () => {
    expect(() =>
      decodeContactCollaboratorBaseline({
        version: 3,
        callerState: "ADMIN",
        collaborators: [{ actorId: 7, access: "READ" }],
      }),
    ).toThrow("联系人协作者数据暂时不可用");
    expect(() =>
      decodeContactCollaboratorBaseline({
        version: 3,
        callerState: "OWNER",
        collaborators: [
          { actorId: 7, access: "READ" },
          { actorId: 7, access: "WRITE" },
        ],
      }),
    ).toThrow("联系人协作者数据暂时不可用");
  });
});
