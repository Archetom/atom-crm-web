const positiveIdentifier = /^[1-9]\d*$/;

/** Parses the list-owned detail selection without accepting route or record IDs from another source. */
export function selectedProductIdFromSearch(search: string): number | null {
  const value = new URLSearchParams(search).get("productId");
  if (value === null || !positiveIdentifier.test(value)) return null;

  const productId = Number(value);
  return Number.isSafeInteger(productId) ? productId : null;
}
