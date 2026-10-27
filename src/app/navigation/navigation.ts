import type { NavigationItem } from "~/shared/types/api";

export function flattenNavigation(items: NavigationItem[]): NavigationItem[] {
  return items.flatMap((item) => [item, ...flattenNavigation(item.children ?? [])]);
}

export function findNavigationByRoute(
  items: NavigationItem[],
  pathname: string,
): NavigationItem | undefined {
  return flattenNavigation(items).find((item) => item.route === pathname);
}

export function phaseForRoute(route: string): string {
  if (route.startsWith("/crm/")) return "P3";
  if (route.startsWith("/marketing/")) return "P6";
  if (route.startsWith("/oa/") || route === "/reports") return "P6";
  if (route.startsWith("/organization/") || route.startsWith("/administration/")) return "P7";
  if (route.startsWith("/workflows")) return "P5";
  return "P1";
}
