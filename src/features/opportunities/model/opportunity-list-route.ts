const positiveIdentifier = /^[1-9]\d*$/;

/** Parses the list-owned detail selection without accepting route or record IDs from another source. */
export function selectedOpportunityIdFromSearch(search: string): number | null {
  const value = new URLSearchParams(search).get("opportunityId");
  if (value === null || !positiveIdentifier.test(value)) return null;

  const opportunityId = Number(value);
  return Number.isSafeInteger(opportunityId) ? opportunityId : null;
}
