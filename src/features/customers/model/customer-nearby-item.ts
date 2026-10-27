import { toCustomerListItem, type CustomerListItem } from "./customer-list-item";
import { recordOf } from "~/shared/utils/decode";

export interface CustomerNearbyItem {
  customer: CustomerListItem;
  distanceMeters: number;
}

/** Keep only a server-returned customer projection and its bounded distance. */
export function toCustomerNearbyItem(value: unknown): CustomerNearbyItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const customer = toCustomerListItem(source.customer);
  const distanceMeters = source.distanceMeters;
  if (
    customer === null ||
    typeof distanceMeters !== "number" ||
    !Number.isSafeInteger(distanceMeters) ||
    distanceMeters < 0
  ) {
    return null;
  }

  return { customer, distanceMeters };
}
