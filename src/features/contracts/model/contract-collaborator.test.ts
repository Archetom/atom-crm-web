import { describe, expect, it } from "vitest";

import { decodeContractCollaboratorBaseline } from "./contract-collaborator";

describe("decodeContractCollaboratorBaseline", () => {
  it("keeps the authoritative versioned collaborator baseline and caller state", () => {
    expect(
      decodeContractCollaboratorBaseline({
        callerState: "WRITE",
        collaborators: [{ access: "READ", actorId: 8, effectiveUntil: "2026-08-20" }],
        version: 3,
      }),
    ).toEqual({
      callerState: "WRITE",
      collaborators: [{ access: "READ", actorId: 8, effectiveUntil: "2026-08-20" }],
      version: 3,
    });
  });

  it("fails closed when the replacement baseline is incomplete or ambiguous", () => {
    expect(() =>
      decodeContractCollaboratorBaseline({ callerState: "READ", collaborators: [], version: -1 }),
    ).toThrow("合同协作者数据暂时不可用");
    expect(() =>
      decodeContractCollaboratorBaseline({
        callerState: "NONE",
        collaborators: [
          { access: "READ", actorId: 8, effectiveUntil: null },
          { access: "WRITE", actorId: 8, effectiveUntil: null },
        ],
        version: 3,
      }),
    ).toThrow("合同协作者数据暂时不可用");
  });
});
