export interface CrmContextNavigation {
  readonly routes: readonly string[];
  readonly title: string;
}

const contexts: readonly CrmContextNavigation[] = [
  {
    routes: ["/crm/customers", "/crm/customer-pools"],
    title: "客户管理",
  },
  {
    routes: ["/crm/contacts", "/crm/contact-pools"],
    title: "联系人管理",
  },
];

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Returns the server-navigation context that owns the current CRM route. */
export function crmContextForPath(pathname: string): CrmContextNavigation | null {
  return (
    contexts.find((context) => context.routes.some((route) => matchesRoute(pathname, route))) ??
    null
  );
}

/**
 * Secondary CRM context routes stay in their local rail. The first route in
 * each context remains a primary module in the desktop top navigation.
 */
export function isCrmContextRoute(route: string): boolean {
  return contexts.some((context) => context.routes.slice(1).includes(route));
}
