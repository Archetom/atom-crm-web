/** Restores a customer drawer only for a decimal positive safe detail ID. */
export function selectedCustomerIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get("customerId");
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null;

  const customerId = Number(raw);
  return Number.isSafeInteger(customerId) ? customerId : null;
}
