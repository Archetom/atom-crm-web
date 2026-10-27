import type { components } from "~/api/generated/schema";

export type SavedView = components["schemas"]["SavedViewResponse"];

/** `undefined` follows the server default; `null` explicitly means no saved view. */
export type SavedViewSelection = number | null | undefined;

/** Parses the URL without allowing an invalid view identifier into a query. */
export function savedViewSelectionFromSearch(search: string): SavedViewSelection {
  const value = new URLSearchParams(search).get("savedView");
  if (value === "all") return null;
  if (value === null) return undefined;
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export function resolveSavedView(
  views: readonly SavedView[],
  selection: SavedViewSelection,
): SavedView | undefined {
  if (selection === null) return undefined;
  if (selection === undefined) return views.find((view) => view.defaultView);
  return views.find((view) => view.id === selection);
}
