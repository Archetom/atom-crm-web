import type { components } from "~/api/generated/schema";

export type NavigationPreference = components["schemas"]["NavigationPreferenceResponse"];
export type NavigationPreferenceItem = components["schemas"]["NavigationItemResponse"];
export type NavigationPreferenceUpdate = components["schemas"]["NavigationPreferenceUpdateRequest"];

export interface FlattenedNavigationPreferenceItem {
  depth: number;
  item: NavigationPreferenceItem;
}

export function flattenNavigationPreferenceItems(
  items: NavigationPreferenceItem[],
  depth = 0,
): FlattenedNavigationPreferenceItem[] {
  return items.flatMap((item) => [
    { depth, item },
    ...flattenNavigationPreferenceItems(item.children, depth + 1),
  ]);
}

export function navigationPreferenceOrder(preference: NavigationPreference): string[] {
  const knownCodes = flattenNavigationPreferenceItems(preference.availableItems).map(
    ({ item }) => item.code,
  );
  const existingCodes = new Set(preference.orderedCodes);
  return [...preference.orderedCodes, ...knownCodes.filter((code) => !existingCodes.has(code))];
}

function findSiblingCodes(items: NavigationPreferenceItem[], code: string): string[] | null {
  if (items.some((item) => item.code === code)) return items.map((item) => item.code);

  for (const item of items) {
    const siblingCodes = findSiblingCodes(item.children, code);
    if (siblingCodes !== null) return siblingCodes;
  }

  return null;
}

export function canMoveNavigationPreferenceItem(
  preference: NavigationPreference,
  code: string,
  direction: "up" | "down",
): boolean {
  const siblingCodes = findSiblingCodes(preference.availableItems, code);
  if (siblingCodes === null) return false;

  const index = siblingCodes.indexOf(code);
  return direction === "up" ? index > 0 : index >= 0 && index < siblingCodes.length - 1;
}

export function reorderNavigationPreference(
  preference: NavigationPreference,
  code: string,
  direction: "up" | "down",
): NavigationPreference {
  const siblingCodes = findSiblingCodes(preference.availableItems, code);
  if (siblingCodes === null) return preference;

  const siblingIndex = siblingCodes.indexOf(code);
  const nextSiblingIndex = direction === "up" ? siblingIndex - 1 : siblingIndex + 1;
  if (siblingIndex < 0 || nextSiblingIndex < 0 || nextSiblingIndex >= siblingCodes.length) {
    return preference;
  }

  const orderedCodes = navigationPreferenceOrder(preference);
  const currentIndex = orderedCodes.indexOf(code);
  const nextCode = siblingCodes[nextSiblingIndex];
  const nextIndex = orderedCodes.indexOf(nextCode);
  if (currentIndex < 0 || nextIndex < 0) return preference;

  const nextOrder = [...orderedCodes];
  [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
  return { ...preference, orderedCodes: nextOrder };
}

export function setNavigationPreferenceHidden(
  preference: NavigationPreference,
  code: string,
  hidden: boolean,
): NavigationPreference {
  const hiddenCodes = new Set(preference.hiddenCodes);
  if (hidden) {
    hiddenCodes.add(code);
  } else {
    hiddenCodes.delete(code);
  }

  return { ...preference, hiddenCodes: [...hiddenCodes] };
}

export function toNavigationPreferenceUpdate(
  preference: NavigationPreference,
): NavigationPreferenceUpdate {
  return {
    hiddenCodes: preference.hiddenCodes,
    orderedCodes: navigationPreferenceOrder(preference),
    ...(preference.version === null ? {} : { version: preference.version }),
  };
}
