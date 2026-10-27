function normalizedListSearch(value: string): string {
  if (value === "") return "";
  return value.startsWith("?") ? value : `?${value}`;
}

function savedListSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  if (!params.has("returnTo")) return null;

  const value = params.get("returnTo") ?? "";
  if (value === "") return "";
  return value.startsWith("?") && !value.includes("#") ? value : null;
}

function globalEntryPath(listPath: string, entry: string, listSearch: string): string {
  const search = new URLSearchParams({ returnTo: normalizedListSearch(listSearch) });
  return `${listPath}/${entry}?${search.toString()}`;
}

function positiveIdentifier(value: string | null): number | null {
  if (value === null || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

/** Opens a static global create route while preserving only its list query. */
export function customerContextGlobalCreatePath(listPath: string, listSearch: string): string {
  return globalEntryPath(listPath, "new", listSearch);
}

/** Opens a static global batch-create route while preserving only its list query. */
export function customerContextGlobalBatchCreatePath(listPath: string, listSearch: string): string {
  return globalEntryPath(listPath, "batch-new", listSearch);
}

/** Carries a static global list query into a customer-context detail route. */
export function customerContextGlobalDetailPath(
  customerContextPath: string,
  listSearch: string,
): string {
  const search = new URLSearchParams({ returnTo: normalizedListSearch(listSearch) });
  return `${customerContextPath}?${search.toString()}`;
}

/**
 * Opens the fixed customer-context receivable form from a global receivable-plan row.
 * The query only carries a static return target and opaque candidate ID; the form must
 * re-read and validate the plan, contract, and customer before using it.
 */
export function customerContextPlanReceivableCreatePath(
  customerId: number,
  planId: number,
  listSearch: string,
): string {
  const search = new URLSearchParams({
    planId: String(planId),
    returnTarget: "receivable-plans",
    returnTo: normalizedListSearch(listSearch),
  });
  return `/crm/customers/${customerId}/receivables/new?${search.toString()}`;
}

/** Returns the only permitted global return destination for a customer receivable form. */
export function customerContextReceivableReturnPath(createSearch: string): string | null {
  const listSearch = savedListSearch(createSearch);
  if (listSearch === null) return null;

  const returnTarget = new URLSearchParams(createSearch).get("returnTarget");
  if (returnTarget === null || returnTarget === "receivables") {
    return `/crm/receivables${listSearch}`;
  }
  if (returnTarget === "receivable-plans") {
    return `/crm/receivable-plans${listSearch}`;
  }
  return null;
}

/** Reads an untrusted requested plan ID; the receiving form must validate it server-side. */
export function customerContextReceivableRequestedPlanId(createSearch: string): number | null {
  const search = new URLSearchParams(createSearch);
  return search.get("returnTarget") === "receivable-plans"
    ? positiveIdentifier(search.get("planId"))
    : null;
}

/**
 * Carries the already validated list query to a customer-context form. The
 * route itself remains fixed by the caller; no user value can replace it.
 */
export function customerContextNestedCreatePath(
  customerContextPath: string,
  globalCreateSearch: string,
): string {
  const listSearch = savedListSearch(globalCreateSearch) ?? "";
  const search = new URLSearchParams({ returnTo: listSearch });
  return `${customerContextPath}?${search.toString()}`;
}

/**
 * Returns the static global list path plus its stored query, or null when the
 * form was entered from its ordinary customer-context route.
 */
export function customerContextGlobalListPath(
  listPath: string,
  createSearch: string,
): string | null {
  const listSearch = savedListSearch(createSearch);
  return listSearch === null ? null : `${listPath}${listSearch}`;
}
