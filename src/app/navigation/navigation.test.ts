import { describe, expect, it } from "vitest";

import { findNavigationByRoute, flattenNavigation, phaseForRoute } from "./navigation";

const navigation = [
  {
    code: "crm",
    parentCode: null,
    route: null,
    titleKey: "navigation.crm",
    order: 10,
    requiredAuthority: null,
    children: [
      {
        code: "crm.customers",
        parentCode: "crm",
        route: "/crm/customers",
        titleKey: "navigation.customers",
        order: 10,
        requiredAuthority: "customers:read",
        children: [],
      },
    ],
  },
];

describe("navigation helpers", () => {
  it("keeps nested server menu entries discoverable by stable route", () => {
    expect(flattenNavigation(navigation)).toHaveLength(2);
    expect(findNavigationByRoute(navigation, "/crm/customers")?.code).toBe("crm.customers");
  });

  it("classifies the stage-workflow route as P5", () => {
    expect(phaseForRoute("/workflows")).toBe("P5");
  });
});
