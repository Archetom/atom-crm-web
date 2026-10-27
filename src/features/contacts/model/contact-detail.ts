import {
  decodeControlledFileFields,
  type ControlledFileField,
} from "~/components/controlled-file-field/model";
import { decodeCustomFieldValues, type CustomFieldValues } from "~/components/dynamic-field";
import { optionalString, recordOf } from "~/shared/utils/decode";

export interface ContactDetail {
  id: number;
  version: number;
  name: string;
  ownerActorId: number | null;
  customerId: number | null;
  parentContactId: number | null;
  phoneNumber: string | null;
  telephone: string | null;
  jobTitle: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  nextContactTime: string | null;
  status: string | null;
  locked: boolean | null;
  starred: boolean;
  dealStatus: string | null;
  customFields?: CustomFieldValues;
  fileFields: readonly ControlledFileField[];
  addresses?: readonly ContactAddress[];
  tags: readonly string[];
  createdTime: string | null;
  updatedTime: string | null;
}

export interface ContactAddress {
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

function decodeAddresses(value: unknown): readonly ContactAddress[] | undefined {
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
 * A narrow, fail-closed projection of the generated ContactResponse. Custom
 * scalar values remain display-only; FILE fields retain only server-authorized
 * paths for the controlled download flow.
 */
export function toContactDetail(value: unknown): ContactDetail | null {
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
    customerId: optionalIdentifier(source.customerId),
    parentContactId: optionalIdentifier(source.parentContactId),
    phoneNumber: optionalString(source.phoneNumber),
    telephone: optionalString(source.telephone),
    jobTitle: optionalString(source.jobTitle),
    email: optionalString(source.email),
    website: optionalString(source.website),
    description: optionalString(source.description),
    nextContactTime: optionalString(source.nextContactTime),
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
