import { recordOf } from "~/shared/utils/decode";

export interface InvoiceProfileListItem {
  id: number;
  customerId: number;
  version: number;
  titleType: string;
  title: string;
  taxNumber: string | null;
  updatedTime: string | null;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Invoice profile success responses are opaque in the current OpenAPI snapshot.
 * Keep the customer list projection deliberately narrow and never retain bank,
 * address, phone, or free-form remark fields.
 */
export function toInvoiceProfileListItem(value: unknown): InvoiceProfileListItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const customerId = positiveIdentifier(source.customerId);
  const titleType = optionalText(source.titleType);
  const title = optionalText(source.title);
  const version = source.version;
  if (
    id === null ||
    customerId === null ||
    titleType === null ||
    title === null ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    return null;
  }

  return {
    id,
    customerId,
    version,
    titleType,
    title,
    taxNumber: optionalText(source.taxNumber),
    updatedTime: optionalText(source.updatedTime),
  };
}

export function decodeInvoiceProfileList(value: unknown): readonly InvoiceProfileListItem[] | null {
  if (!Array.isArray(value)) return null;
  const profiles: InvoiceProfileListItem[] = [];
  for (const item of value) {
    const profile = toInvoiceProfileListItem(item);
    if (profile === null) return null;
    profiles.push(profile);
  }
  return profiles;
}
