const positiveIdentifier = /^[1-9]\d*$/;

/** Parses the list-owned detail selection without accepting route or record IDs from another source. */
export function selectedLeadIdFromSearch(search: string): number | null {
  const value = new URLSearchParams(search).get("leadId");
  if (value === null || !positiveIdentifier.test(value)) return null;

  const leadId = Number(value);
  return Number.isSafeInteger(leadId) ? leadId : null;
}
