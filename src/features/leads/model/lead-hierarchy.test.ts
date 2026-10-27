import { describe, expect, it } from "vitest";

import { toLeadHierarchy, visibleDescendantIds } from "./lead-hierarchy";

describe("toLeadHierarchy", () => {
  it("keeps only the visible hierarchy returned for the requested lead", () => {
    const hierarchy = toLeadHierarchy(
      {
        requestedLeadId: 2,
        leads: [
          { id: 1, name: "总部线索", parentLeadId: null },
          { id: 2, name: "华东线索", parentLeadId: 1 },
          { id: 3, name: "上海线索", parentLeadId: 2 },
          { id: 4, name: "浦东线索", parentLeadId: 3 },
        ],
      },
      2,
    );

    expect(hierarchy).toMatchObject({ requestedLeadId: 2 });
    expect(hierarchy === null ? [] : [...visibleDescendantIds(hierarchy)]).toEqual([3, 4]);
  });

  it("fails closed on incomplete or duplicated nodes", () => {
    expect(toLeadHierarchy({ requestedLeadId: 2, leads: [{ id: 2 }] }, 2)).toBeNull();
    expect(
      toLeadHierarchy(
        {
          requestedLeadId: 2,
          leads: [
            { id: 2, name: "线索", parentLeadId: null },
            { id: 2, name: "重复线索", parentLeadId: null },
          ],
        },
        2,
      ),
    ).toBeNull();
  });
});
