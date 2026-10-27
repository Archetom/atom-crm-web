import { describe, expect, it } from "vitest";

import type { components } from "~/api/generated/schema";

import {
  flattenNavigationPreferenceItems,
  reorderNavigationPreference,
  setNavigationPreferenceHidden,
  toNavigationPreferenceUpdate,
  type NavigationPreference,
} from "./navigation-preference";

const availableItems: components["schemas"]["NavigationItemResponse"][] = [
  {
    children: [
      {
        children: [],
        code: "crm.contacts",
        order: 1,
        parentCode: "crm",
        requiredAuthority: "contacts:read",
        route: "/crm/contacts",
        titleKey: "navigation.contacts",
      },
      {
        children: [],
        code: "crm.customers",
        order: 2,
        parentCode: "crm",
        requiredAuthority: "customers:read",
        route: "/crm/customers",
        titleKey: "navigation.customers",
      },
    ],
    code: "crm",
    order: 1,
    parentCode: null,
    requiredAuthority: null,
    route: null,
    titleKey: "navigation.crm",
  },
  {
    children: [],
    code: "workspace.home",
    order: 2,
    parentCode: null,
    requiredAuthority: "navigation:read",
    route: "/",
    titleKey: "navigation.home",
  },
];

function preference(overrides: Partial<NavigationPreference> = {}): NavigationPreference {
  return {
    availableItems,
    hiddenCodes: ["retired.menu"],
    orderedCodes: ["retired.menu", "crm", "crm.customers", "workspace.home"],
    version: 4,
    ...overrides,
  };
}

describe("navigation preference model", () => {
  it("flattens only the server-authorized recovery candidate tree", () => {
    expect(flattenNavigationPreferenceItems(availableItems)).toEqual([
      { depth: 0, item: availableItems[0] },
      { depth: 1, item: availableItems[0].children[0] },
      { depth: 1, item: availableItems[0].children[1] },
      { depth: 0, item: availableItems[1] },
    ]);
  });

  it("reorders only siblings while retaining unknown server baseline codes", () => {
    const reordered = reorderNavigationPreference(preference(), "crm.contacts", "down");

    expect(reordered.orderedCodes).toEqual([
      "retired.menu",
      "crm",
      "crm.contacts",
      "workspace.home",
      "crm.customers",
    ]);
    expect(reordered.hiddenCodes).toEqual(["retired.menu"]);
  });

  it("builds a complete update without fabricating an initial version", () => {
    const hidden = setNavigationPreferenceHidden(
      preference({ orderedCodes: ["retired.menu"] as string[], version: null }),
      "crm",
      true,
    );

    expect(toNavigationPreferenceUpdate(hidden)).toEqual({
      hiddenCodes: ["retired.menu", "crm"],
      orderedCodes: ["retired.menu", "crm", "crm.contacts", "crm.customers", "workspace.home"],
    });
  });
});
