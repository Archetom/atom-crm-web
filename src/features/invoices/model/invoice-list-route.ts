/** Restores a drawer selection only when the global-list URL carries a positive safe ID. */
export function selectedInvoiceIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get("invoiceId");
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null;

  const invoiceId = Number(raw);
  return Number.isSafeInteger(invoiceId) ? invoiceId : null;
}
