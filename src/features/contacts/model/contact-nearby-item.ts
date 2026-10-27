import { toContactListItem, type ContactListItem } from "./contact-list-item";
import { recordOf } from "~/shared/utils/decode";

export interface ContactNearbyItem {
  contact: ContactListItem;
  distanceMeters: number;
}

/** Keep only a server-returned contact projection and its bounded distance. */
export function toContactNearbyItem(value: unknown): ContactNearbyItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const contact = toContactListItem(source.contact);
  const distanceMeters = source.distanceMeters;
  if (
    contact === null ||
    typeof distanceMeters !== "number" ||
    !Number.isSafeInteger(distanceMeters) ||
    distanceMeters < 0
  ) {
    return null;
  }

  return { contact, distanceMeters };
}
