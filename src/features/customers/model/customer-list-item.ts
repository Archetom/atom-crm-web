import { decodeCustomFieldValues, type CustomFieldValues } from "~/components/dynamic-field";
import { optionalString, recordOf } from "~/shared/utils/decode";

export interface CustomerListItem {
  customFields?: CustomFieldValues;
  id: number;
  lastActivityContent: string | null;
  lastActivityTime: string | null;
  name: string;
  ownerActorId: number | null;
  phoneNumber: string | null;
  status: string | null;
  starred: boolean;
  tags: string[];
  updatedTime: string | null;
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

export function toCustomerListItem(value: unknown): CustomerListItem | null {
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
    ownerActorId: optionalNumber(source.ownerActorId),
    phoneNumber: optionalString(source.phoneNumber),
    status: optionalString(source.status),
    starred: source.starred === true,
    tags: Array.isArray(source.tags)
      ? source.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    updatedTime: optionalString(source.updatedTime),
    ...(version === null || version < 0 ? {} : { version }),
  };
}
