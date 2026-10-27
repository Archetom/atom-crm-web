import { toLeadListItem, type LeadListItem } from "./lead-list-item";
import { recordOf } from "~/shared/utils/decode";

export interface LeadNearbyItem {
  lead: LeadListItem;
  distanceMeters: number;
}

/** Keep only a server-returned lead projection and its bounded distance. */
export function toLeadNearbyItem(value: unknown): LeadNearbyItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const lead = toLeadListItem(source.lead);
  const distanceMeters = source.distanceMeters;
  if (
    lead === null ||
    typeof distanceMeters !== "number" ||
    !Number.isSafeInteger(distanceMeters) ||
    distanceMeters < 0
  ) {
    return null;
  }

  return { lead, distanceMeters };
}
