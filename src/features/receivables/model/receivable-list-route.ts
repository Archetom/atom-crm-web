/** Restores a drawer selection only when the global-list URL carries a positive safe ID. */
export function selectedReceivableIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get("receivableId");
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null;

  const receivableId = Number(raw);
  return Number.isSafeInteger(receivableId) ? receivableId : null;
}
