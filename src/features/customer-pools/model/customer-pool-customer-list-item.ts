import type { components } from "~/api/generated/schema";
import {
  toCustomerListItem,
  type CustomerListItem,
} from "~/features/customers/model/customer-list-item";

export interface CustomerPoolCustomerListItem extends CustomerListItem {
  version: number;
}

/**
 * Pool actions require the server-issued optimistic-lock version. The response
 * remains a generated CustomerResponse; this projects only UI-safe fields.
 */
export function toCustomerPoolCustomerListItem(
  value: components["schemas"]["CustomerResponse"],
): CustomerPoolCustomerListItem | null {
  const customer = toCustomerListItem(value);
  const version = value.version;
  if (
    customer === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    return null;
  }

  return { ...customer, version };
}
