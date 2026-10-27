import { describe, expect, it } from "vitest";

import { toContactHierarchy, visibleDescendantIds } from "./contact-hierarchy";

describe("toContactHierarchy", () => {
  it("keeps only the visible hierarchy returned for the requested contact", () => {
    const hierarchy = toContactHierarchy(
      {
        requestedContactId: 2,
        contacts: [
          { id: 1, name: "总部联系人", parentContactId: null },
          { id: 2, name: "华东联系人", parentContactId: 1 },
          { id: 3, name: "上海联系人", parentContactId: 2 },
          { id: 4, name: "浦东联系人", parentContactId: 3 },
        ],
      },
      2,
    );

    expect(hierarchy).toMatchObject({ requestedContactId: 2 });
    expect(hierarchy === null ? [] : [...visibleDescendantIds(hierarchy)]).toEqual([3, 4]);
  });

  it("fails closed on an incomplete response", () => {
    expect(toContactHierarchy({ requestedContactId: 2, contacts: [{ id: 2 }] }, 2)).toBeNull();
    expect(toContactHierarchy({ requestedContactId: 3, contacts: [] }, 2)).toBeNull();
  });
});
