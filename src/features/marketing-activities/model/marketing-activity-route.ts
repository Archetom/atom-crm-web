/** Restores an activity drawer only for a positive safe detail ID. */
export function selectedMarketingActivityIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get("activityId");
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null;

  const activityId = Number(raw);
  return Number.isSafeInteger(activityId) ? activityId : null;
}
