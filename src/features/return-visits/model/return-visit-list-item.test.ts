import { describe, expect, it } from "vitest";

import { toReturnVisitListItem } from "./return-visit-list-item";

describe("toReturnVisitListItem", () => {
  it("keeps the server-authorized return-visit projection", () => {
    expect(
      toReturnVisitListItem({
        approvalStatus: "APPROVED",
        id: 8,
        version: 3,
        ownerActorId: 2,
        customerId: 4,
        contactId: 5,
        contactRelationState: "VISIBLE",
        contractId: 6,
        contractRelationState: "VISIBLE",
        visitNumber: "RV-20260725-0008",
        visitTime: "2026-07-25T09:00:00",
        visitForm: "PHONE",
        satisfaction: "SATISFIED",
        remark: "确认续约安排",
        status: "ACTIVE",
        createdTime: "2026-07-25T09:00:00",
        updatedTime: "2026-07-25T10:00:00",
        customFields: { internal: ["ignored"] },
      }),
    ).toEqual({
      approvalStatus: "APPROVED",
      id: 8,
      version: 3,
      ownerActorId: 2,
      customerId: 4,
      contactId: 5,
      contactRelationState: "VISIBLE",
      contractId: 6,
      contractRelationState: "VISIBLE",
      visitNumber: "RV-20260725-0008",
      visitTime: "2026-07-25T09:00:00",
      visitForm: "PHONE",
      satisfaction: "SATISFIED",
      remark: "确认续约安排",
      status: "ACTIVE",
      createdTime: "2026-07-25T09:00:00",
      updatedTime: "2026-07-25T10:00:00",
      customFields: { internal: ["ignored"] },
    });
  });

  it("retains only stable identity and version when field access hides business fields", () => {
    expect(
      toReturnVisitListItem({
        approvalStatus: null,
        customerId: null,
        id: 8,
        version: 0,
        visitTime: null,
      }),
    ).toEqual({
      approvalStatus: null,
      id: 8,
      version: 0,
      ownerActorId: null,
      customerId: null,
      contactId: null,
      contactRelationState: "HIDDEN",
      contractId: null,
      contractRelationState: "HIDDEN",
      visitNumber: null,
      visitTime: null,
      visitForm: null,
      satisfaction: null,
      remark: null,
      status: null,
      createdTime: null,
      updatedTime: null,
    });
  });

  it("fails closed without a positive ID and a non-negative version", () => {
    expect(toReturnVisitListItem({ id: 8 })).toBeNull();
    expect(toReturnVisitListItem({ id: 0, version: 1 })).toBeNull();
    expect(toReturnVisitListItem({ id: 8, version: -1 })).toBeNull();
  });

  it("keeps a relation editable only when the server returns a coherent visible or empty state", () => {
    expect(
      toReturnVisitListItem({
        contactId: null,
        contactRelationState: "EMPTY",
        contractId: 6,
        contractRelationState: "HIDDEN",
        customerId: 4,
        id: 8,
        version: 3,
      }),
    ).toMatchObject({ contactRelationState: "EMPTY", contractRelationState: "HIDDEN" });

    expect(
      toReturnVisitListItem({
        contactId: null,
        contactRelationState: "VISIBLE",
        contractId: 6,
        contractRelationState: "EMPTY",
        customerId: 4,
        id: 8,
        version: 3,
      }),
    ).toMatchObject({ contactRelationState: "HIDDEN", contractRelationState: "HIDDEN" });
  });

  it("drops an unrecognized approval status while retaining the visible record projection", () => {
    expect(
      toReturnVisitListItem({
        approvalStatus: "ACTIVE",
        customerId: 4,
        id: 8,
        version: 3,
      }),
    ).toMatchObject({ approvalStatus: null, customerId: 4, id: 8, version: 3 });
  });
});
