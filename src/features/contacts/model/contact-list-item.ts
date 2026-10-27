import { decodeCustomFieldValues, type CustomFieldValues } from "~/components/dynamic-field";
import { optionalString, recordOf } from "~/shared/utils/decode";

export interface ContactListItem {
  customFields?: CustomFieldValues;
  id: number;
  lastActivityContent: string | null;
  lastActivityTime: string | null;
  name: string;
  customerId: number | null;
  nextContactTime: string | null;
  ownerActorId: number | null;
  phoneNumber: string | null;
  jobTitle: string | null;
  status: string | null;
  starred: boolean;
  tags: string[];
  version?: number;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function optionalLocalDateTime(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/.test(value)
  ) {
    return null;
  }
  return value;
}

/** Narrow, fail-closed list projection of the generated Contact response contract. */
export function toContactListItem(value: unknown): ContactListItem | null {
  const source = recordOf(value);
  if (!source) return null;

  const id = optionalNumber(source.id);
  const name = optionalString(source.name);
  const version = optionalNumber(source.version);
  if (id === null || name === null) return null;

  return {
    id,
    ...(source.customFields === undefined
      ? {}
      : { customFields: decodeCustomFieldValues(source.customFields) }),
    lastActivityContent: optionalString(source.lastActivityContent),
    lastActivityTime: optionalLocalDateTime(source.lastActivityTime),
    name,
    customerId: optionalNumber(source.customerId),
    nextContactTime: optionalLocalDateTime(source.nextContactTime),
    ownerActorId: optionalNumber(source.ownerActorId),
    phoneNumber: optionalString(source.phoneNumber),
    jobTitle: optionalString(source.jobTitle),
    status: optionalString(source.status),
    starred: source.starred === true,
    tags: Array.isArray(source.tags)
      ? source.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    ...(version === null || version < 0 ? {} : { version }),
  };
}
