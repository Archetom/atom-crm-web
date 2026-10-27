import {
  decodeControlledFileFields,
  type ControlledFileField,
} from "~/components/controlled-file-field/model";
import {
  decodeCustomFieldValues,
  type CustomFieldValues,
} from "~/components/dynamic-field/model/custom-field-values";
import { optionalString, recordOf } from "~/shared/utils/decode";

export interface CustomerDetail {
  id: number;
  version: number;
  name: string;
  ownerActorId: number | null;
  parentCustomerId: number | null;
  phoneNumber: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  status: string | null;
  locked: boolean | null;
  starred: boolean;
  dealStatus: string | null;
  customFields?: CustomFieldValues;
  fileFields?: readonly ControlledFileField[];
  addresses?: readonly CustomerAddress[];
  tags: readonly string[];
  createdTime: string | null;
  updatedTime: string | null;
}

export interface CustomerAddress {
  label: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  postalCode: string | null;
  addressLine: string;
  primary: boolean;
}

function optionalIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function decodeAddresses(value: unknown): readonly CustomerAddress[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value.flatMap((item) => {
    const source = recordOf(item);
    const addressLine = source === null ? null : optionalString(source.addressLine);
    if (addressLine === null || source === null) return [];

    return [
      {
        label: optionalString(source.label),
        country: optionalString(source.country),
        region: optionalString(source.region),
        city: optionalString(source.city),
        postalCode: optionalString(source.postalCode),
        addressLine,
        primary: source.primary === true,
      },
    ];
  });
}

/**
 * A fail-closed display projection. Custom scalar values are already filtered
 * and masked by the server; this boundary keeps them display-only. FILE fields
 * retain only server-issued codes and attachment metadata for controlled download.
 */
export function toCustomerDetail(value: unknown): CustomerDetail | null {
  const source = recordOf(value);
  if (!source) return null;

  const id = optionalIdentifier(source.id);
  const name = optionalString(source.name);
  const version =
    typeof source.version === "number" &&
    Number.isSafeInteger(source.version) &&
    source.version >= 0
      ? source.version
      : null;
  if (id === null || name === null || version === null) return null;

  return {
    id,
    version,
    name,
    ownerActorId: optionalIdentifier(source.ownerActorId),
    parentCustomerId: optionalIdentifier(source.parentCustomerId),
    phoneNumber: optionalString(source.phoneNumber),
    telephone: optionalString(source.telephone),
    email: optionalString(source.email),
    website: optionalString(source.website),
    description: optionalString(source.description),
    status: optionalString(source.status),
    locked: optionalBoolean(source.locked),
    starred: source.starred === true,
    dealStatus: optionalString(source.dealStatus),
    ...(source.customFields === undefined
      ? {}
      : { customFields: decodeCustomFieldValues(source.customFields) }),
    fileFields: decodeControlledFileFields(source.fileFields),
    ...(Array.isArray(source.addresses) ? { addresses: decodeAddresses(source.addresses) } : {}),
    tags: Array.isArray(source.tags)
      ? source.tags.filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
      : [],
    createdTime: optionalString(source.createdTime),
    updatedTime: optionalString(source.updatedTime),
  };
}
