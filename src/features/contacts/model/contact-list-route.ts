const positiveIdentifier = /^[1-9]\d*$/;

/** Parses the list-owned detail selection without accepting route or record IDs from another source. */
export function selectedContactIdFromSearch(search: string): number | null {
  const value = new URLSearchParams(search).get("contactId");
  if (value === null || !positiveIdentifier.test(value)) return null;

  const contactId = Number(value);
  return Number.isSafeInteger(contactId) ? contactId : null;
}
