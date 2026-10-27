import { describe, expect, it } from "vitest";

import type { MemberAuthorization, NavigationItem } from "~/shared/types/api";

import { globalCreateActions } from "./global-create";

const navigation: NavigationItem[] = [
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
      {
        code: "crm.leads",
        parentCode: "crm",
        route: "/crm/leads",
        titleKey: "navigation.leads",
        order: 20,
        requiredAuthority: "leads:read",
        children: [],
      },
    ],
  },
];

function authorization(authorities: string[]): MemberAuthorization {
  return { actorId: 9, authorities, dataScopes: {}, roles: [] };
}

describe("globalCreateActions", () => {
  it("only exposes routes that are both server-visible and writable", () => {
    expect(
      globalCreateActions(
        navigation,
        authorization(["customers:read", "customers:write", "leads:read"]),
      ),
    ).toEqual([{ key: "customer", label: "新建客户", to: "/crm/customers/new" }]);
  });

  it("does not surface a writable route that the server navigation withholds", () => {
    expect(
      globalCreateActions(navigation, authorization(["contacts:read", "contacts:write"])),
    ).toEqual([]);
  });

  it("opens a server-visible writable market activity as an in-page creation flow", () => {
    const activityNavigation: NavigationItem[] = [
      {
        ...navigation[0],
        children: [
          ...navigation[0].children,
          {
            code: "crm.marketing-activities",
            parentCode: "crm",
            route: "/crm/marketing-activities",
            titleKey: "navigation.marketingActivities",
            order: 70,
            requiredAuthority: "marketing-activities:read",
            children: [],
          },
        ],
      },
    ];

    expect(
      globalCreateActions(
        activityNavigation,
        authorization(["marketing-activities:read", "marketing-activities:write"]),
      ),
    ).toEqual([
      {
        key: "marketing-activity",
        label: "新建市场活动",
        to: "/crm/marketing-activities?create=1",
      },
    ]);
  });

  it("opens return-visit creation only through the server-visible workspace", () => {
    const returnVisitNavigation: NavigationItem[] = [
      {
        ...navigation[0],
        children: [
          ...navigation[0].children,
          {
            code: "crm.return-visits",
            parentCode: "crm",
            route: "/crm/return-visits",
            titleKey: "navigation.returnVisits",
            order: 80,
            requiredAuthority: "return-visits:read",
            children: [],
          },
        ],
      },
    ];

    expect(
      globalCreateActions(
        returnVisitNavigation,
        authorization(["customers:read", "return-visits:read", "return-visits:write"]),
      ),
    ).toEqual([{ key: "return-visit", label: "新建回访", to: "/crm/return-visits/new" }]);
  });

  it("opens customer-bound transaction creation through its server-visible workspace", () => {
    const transactionNavigation: NavigationItem[] = [
      {
        ...navigation[0],
        children: [
          {
            code: "crm.contracts",
            parentCode: "crm",
            route: "/crm/contracts",
            titleKey: "navigation.contracts",
            order: 50,
            requiredAuthority: "contracts:read",
            children: [],
          },
          {
            code: "crm.receivables",
            parentCode: "crm",
            route: "/crm/receivables",
            titleKey: "navigation.receivables",
            order: 60,
            requiredAuthority: "receivables:read",
            children: [],
          },
          {
            code: "crm.invoices",
            parentCode: "crm",
            route: "/crm/invoices",
            titleKey: "navigation.invoices",
            order: 70,
            requiredAuthority: "invoices:read",
            children: [],
          },
        ],
      },
    ];

    expect(
      globalCreateActions(
        transactionNavigation,
        authorization([
          "contracts:read",
          "contracts:write",
          "customers:read",
          "receivables:read",
          "receivables:write",
          "invoices:read",
          "invoices:write",
        ]),
      ),
    ).toEqual([
      { key: "contract", label: "新建合同", to: "/crm/contracts/new" },
      { key: "receivable", label: "新建回款", to: "/crm/receivables/new" },
      { key: "invoice", label: "新建发票", to: "/crm/invoices/new" },
    ]);
  });
});
