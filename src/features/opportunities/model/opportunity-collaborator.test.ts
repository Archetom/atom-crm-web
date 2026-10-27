import { describe, expect, it } from "vitest";

import { decodeOpportunityCollaboratorBaseline } from "./opportunity-collaborator";

describe("decodeOpportunityCollaboratorBaseline", () => {
  it("keeps the complete versioned replacement baseline and caller state", () => {
    expect(
      decodeOpportunityCollaboratorBaseline({
        callerState: "WRITE",
        collaborators: [{ access: "READ", actorId: 8 }],
        version: 3,
      }),
    ).toEqual({
      callerState: "WRITE",
      collaborators: [{ access: "READ", actorId: 8 }],
      version: 3,
    });
  });

  it("fails closed for malformed or ambiguous replacement values", () => {
    expect(() =>
      decodeOpportunityCollaboratorBaseline({
        callerState: "READ",
        collaborators: [],
        version: -1,
      }),
    ).toThrow("商机协作者数据暂时不可用");
    expect(() =>
      decodeOpportunityCollaboratorBaseline({
        callerState: "NONE",
        collaborators: [
          { access: "READ", actorId: 8 },
          { access: "WRITE", actorId: 8 },
        ],
        version: 3,
      }),
    ).toThrow("商机协作者数据暂时不可用");
  });
});
