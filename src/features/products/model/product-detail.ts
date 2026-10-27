import {
  decodeControlledFileFields,
  type ControlledFileField,
} from "~/components/controlled-file-field/model";
import {
  decodeCustomFieldValues,
  type CustomFieldValues,
} from "~/components/dynamic-field/model/custom-field-values";
import { recordOf } from "~/shared/utils/decode";

export interface ProductDetail {
  id: number;
  version: number;
  name: string;
  code: string | null;
  categoryName: string | null;
  unit: string | null;
  listPrice: number | null;
  description: string | null;
  customFields?: CustomFieldValues;
  fileFields: readonly ControlledFileField[];
  availability: string | null;
  status: string | null;
  createdTime: string | null;
  updatedTime: string | null;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * The response is already field-policy filtered by the server. Custom scalar
 * values retain that display-only projection; they never participate in the
 * editable baseline or update request. FILE fields retain only their
 * server-issued codes and valid attachment metadata for controlled download.
 */
export function toProductDetail(value: unknown): ProductDetail | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const name = optionalText(source.name);
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
    code: optionalText(source.code),
    ...(source.customFields === undefined
      ? {}
      : { customFields: decodeCustomFieldValues(source.customFields) }),
    categoryName: optionalText(source.categoryName),
    unit: optionalText(source.unit),
    listPrice: optionalAmount(source.listPrice),
    description: optionalText(source.description),
    fileFields: decodeControlledFileFields(source.fileFields),
    availability: optionalText(source.availability),
    status: optionalText(source.status),
    createdTime: optionalText(source.createdTime),
    updatedTime: optionalText(source.updatedTime),
  };
}
