import { describe, expect, it } from "vitest";

import { decodeCustomerCollaboratorBaseline } from "./customer-collaborator";

describe("decodeCustomerCollaboratorBaseline", () => {
  it("keeps the server-provided replacement baseline", () => {
    expect(
      decodeCustomerCollaboratorBaseline({
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
      decodeCustomerCollaboratorBaseline({
        version: 3,
        callerState: "OWNER",
        collaborators: [
          { actorId: 7, access: "READ" },
          { actorId: 7, access: "WRITE" },
        ],
      }),
    ).toThrow("客户协作者数据暂时不可用");
    expect(() =>
      decodeCustomerCollaboratorBaseline({
        version: 3,
        callerState: "ADMIN",
        collaborators: [],
      }),
    ).toThrow("客户协作者数据暂时不可用");
  });
});
