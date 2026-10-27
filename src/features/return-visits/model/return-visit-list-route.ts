const returnVisitListPath = "/crm/return-visits";

/** Restores a drawer selection only when the list URL carries a positive safe ID. */
export function selectedReturnVisitIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get("returnVisitId");
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null;

  const returnVisitId = Number(raw);
  return Number.isSafeInteger(returnVisitId) ? returnVisitId : null;
}

function normalizedListSearch(listSearch: string): string {
  return listSearch === "" ? "" : listSearch.startsWith("?") ? listSearch : `?${listSearch}`;
}

function savedListSearch(search: string): string | null {
  const returnTo = new URLSearchParams(search).get("returnTo");
  return returnTo === null || !returnTo.startsWith("?") || returnTo.includes("#") ? null : returnTo;
}

/**
 * Carries only this list's query string into the global creation route. The
 * value is never interpreted as a destination path, so it cannot redirect
 * outside the return-visit workspace.
 */
export function returnVisitCreatePath(listSearch: string): string {
  const normalizedSearch = normalizedListSearch(listSearch);
  if (normalizedSearch === "") return `${returnVisitListPath}/new`;

  const search = new URLSearchParams({ returnTo: normalizedSearch });
  return `${returnVisitListPath}/new?${search.toString()}`;
}

/** Restores the saved global-list query after a cancelled creation flow. */
export function returnVisitListPathFromCreateSearch(search: string): string {
  const returnTo = savedListSearch(search);
  return returnTo === null ? returnVisitListPath : `${returnVisitListPath}${returnTo}`;
}

/** Carries the list query through editing so the detail drawer is restored afterwards. */
export function returnVisitEditPath(
  customerId: number,
  returnVisitId: number,
  listSearch: string,
): string {
  const search = new URLSearchParams({ returnTo: normalizedListSearch(listSearch) });
  return `/crm/customers/${customerId}/return-visits/${returnVisitId}/edit?${search.toString()}`;
}

/** Restores a global detail drawer when editing began from the global list. */
export function returnVisitDetailPathFromEditSearch(
  search: string,
  customerId: number | null,
  returnVisitId: number | null,
): string {
  const returnTo = savedListSearch(search);
  if (returnTo !== null && returnVisitId !== null) {
    const params = new URLSearchParams(returnTo);
    params.set("returnVisitId", String(returnVisitId));
    return `${returnVisitListPath}?${params.toString()}`;
  }
  if (customerId === null || returnVisitId === null) return returnVisitListPath;
  return `/crm/customers/${customerId}/return-visits/${returnVisitId}`;
}
