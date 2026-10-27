import { decodeCustomFieldValues, type CustomFieldValues } from "~/components/dynamic-field";
import { recordOf } from "~/shared/utils/decode";

export interface ProductListItem {
  customFields?: CustomFieldValues;
  id: number;
  name: string;
  code: string | null;
  categoryName: string | null;
  unit: string | null;
  availability: string | null;
  status: string | null;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Product queries have an opaque OpenAPI response. Keep only the catalog fields
 * needed by this list. Custom scalar values are retained only because the
 * server has already applied the current caller's field policy to them.
 */
export function toProductListItem(value: unknown): ProductListItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const name = optionalText(source.name);
  if (id === null || name === null) return null;

  return {
    id,
    ...(source.customFields === undefined
      ? {}
      : { customFields: decodeCustomFieldValues(source.customFields) }),
    name,
    code: optionalText(source.code),
    categoryName: optionalText(source.categoryName),
    unit: optionalText(source.unit),
    availability: optionalText(source.availability),
    status: optionalText(source.status),
  };
}
