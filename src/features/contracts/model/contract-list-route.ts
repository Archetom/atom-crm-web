/** Restores a drawer selection only when the list URL carries a positive safe ID. */
export function selectedContractIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get("contractId");
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null;

  const contractId = Number(raw);
  return Number.isSafeInteger(contractId) ? contractId : null;
}
