import { authority, hasAuthority } from "~/app/permissions/authority";
import type { MemberAuthorization, NavigationItem } from "~/shared/types/api";

import { flattenNavigation } from "./navigation";

export interface GlobalCreateAction {
  key: string;
  label: string;
  to: string;
}

interface GlobalCreateDefinition extends GlobalCreateAction {
  additionalAuthorities?: readonly string[];
  navigationRoute: string;
  requiredAuthority: string;
}

const definitions: readonly GlobalCreateDefinition[] = [
  {
    key: "lead",
    label: "新建线索",
    navigationRoute: "/crm/leads",
    requiredAuthority: authority.leadsWrite,
    to: "/crm/leads/new",
  },
  {
    key: "customer",
    label: "新建客户",
    navigationRoute: "/crm/customers",
    requiredAuthority: authority.customersWrite,
    to: "/crm/customers/new",
  },
  {
    key: "contact",
    label: "新建联系人",
    navigationRoute: "/crm/contacts",
    requiredAuthority: authority.contactsWrite,
    to: "/crm/contacts/new",
  },
  {
    key: "opportunity",
    label: "新建商机",
    navigationRoute: "/crm/opportunities",
    requiredAuthority: authority.opportunitiesWrite,
    to: "/crm/opportunities/new",
  },
  {
    key: "product",
    label: "新建产品",
    navigationRoute: "/crm/products",
    requiredAuthority: authority.productsWrite,
    to: "/crm/products/new",
  },
  {
    key: "marketing-activity",
    label: "新建市场活动",
    navigationRoute: "/crm/marketing-activities",
    requiredAuthority: authority.marketingActivitiesWrite,
    to: "/crm/marketing-activities?create=1",
  },
  {
    key: "contract",
    label: "新建合同",
    additionalAuthorities: [authority.customersRead],
    navigationRoute: "/crm/contracts",
    requiredAuthority: authority.contractsWrite,
    to: "/crm/contracts/new",
  },
  {
    key: "receivable",
    label: "新建回款",
    additionalAuthorities: [authority.customersRead],
    navigationRoute: "/crm/receivables",
    requiredAuthority: authority.receivablesWrite,
    to: "/crm/receivables/new",
  },
  {
    key: "invoice",
    label: "新建发票",
    additionalAuthorities: [authority.customersRead],
    navigationRoute: "/crm/invoices",
    requiredAuthority: authority.invoicesWrite,
    to: "/crm/invoices/new",
  },
  {
    key: "return-visit",
    label: "新建回访",
    additionalAuthorities: [authority.customersRead],
    navigationRoute: "/crm/return-visits",
    requiredAuthority: authority.returnVisitsWrite,
    to: "/crm/return-visits/new",
  },
  {
    key: "task",
    label: "新建任务",
    navigationRoute: "/work/tasks",
    requiredAuthority: authority.workTasksWrite,
    to: "/work/tasks/new",
  },
];

/**
 * A global create shortcut is available only when the server navigation exposes
 * the resource and the current member has the matching write authority.
 */
export function globalCreateActions(
  navigation: readonly NavigationItem[],
  authorization: MemberAuthorization | null,
): GlobalCreateAction[] {
  const availableRoutes = new Set(
    flattenNavigation([...navigation])
      .filter((item) => hasAuthority(authorization, item.requiredAuthority))
      .flatMap((item) => (item.route === null ? [] : [item.route])),
  );

  return definitions
    .filter(
      (definition) =>
        availableRoutes.has(definition.navigationRoute) &&
        hasAuthority(authorization, definition.requiredAuthority) &&
        (definition.additionalAuthorities ?? []).every((requiredAuthority) =>
          hasAuthority(authorization, requiredAuthority),
        ),
    )
    .map(({ key, label, to }) => ({ key, label, to }));
}
