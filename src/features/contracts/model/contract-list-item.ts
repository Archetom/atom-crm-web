import { decodeCustomFieldValues, type CustomFieldValues } from "~/components/dynamic-field";
import { nullableString, recordOf } from "~/shared/utils/decode";

export interface ContractListItem {
  customFields?: CustomFieldValues;
  id: number;
  version: number;
  customerId: number;
  contactId: number | null;
  ownerActorId: number | null;
  name: string | null;
  number: string | null;
  orderDate: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
}

function optionalPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * The OpenAPI snapshot currently represents contract query rows as generic objects.
 * Keep only server-authorized values and fail closed unless the server returns a stable
 * contract/customer/version identity. This decoder never reconstructs hidden field values.
 */
export function toContractListItem(value: unknown): ContractListItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = optionalPositiveNumber(source.id);
  const customerId = optionalPositiveNumber(source.customerId);
  const version = source.version;
  if (
    id === null ||
    customerId === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    return null;
  }

  return {
    ...(source.customFields === undefined
      ? {}
      : { customFields: decodeCustomFieldValues(source.customFields) }),
    id,
    version,
    customerId,
    contactId: optionalPositiveNumber(source.contactId),
    ownerActorId: optionalPositiveNumber(source.ownerActorId),
    name: nullableString(source.name),
    number: nullableString(source.number),
    orderDate: nullableString(source.orderDate),
    startDate: nullableString(source.startDate),
    endDate: nullableString(source.endDate),
    status: nullableString(source.status),
  };
}
