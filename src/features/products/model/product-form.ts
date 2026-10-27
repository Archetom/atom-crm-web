import type { components } from "~/api/generated/schema";
import type { ProductImageType } from "./product-image";
import {
  toCustomFieldFormValues,
  type CustomFieldValues,
  type FieldDefinition,
} from "~/components/dynamic-field";

import type { ProductAvailability } from "./product-availability";
import { recordOf } from "~/shared/utils/decode";

export const maximumProductListPrice = Number.MAX_SAFE_INTEGER;

export interface ProductCreateValues {
  availability: ProductAvailability;
  categoryId?: number;
  name: string;
  code: string;
  customFields?: CustomFieldValues;
  description?: string;
  fileFieldSubmission?: ProductFileFieldSubmission;
  productImageSubmission?: ProductImageSubmission;
  listPrice: number;
  ownerActorId?: number;
  unit?: string;
}

/** File IDs can only originate from an unexpired server-issued PRODUCT draft. */
export interface ProductFileFieldSubmission {
  draftId: number;
  fields: Readonly<Record<string, readonly number[]>>;
}

/** File IDs can only originate from an unexpired server-issued Product image draft. */
export interface ProductImageSubmission {
  draftId: number;
  images: Readonly<Partial<Record<ProductImageType, readonly number[]>>>;
}

export interface ProductUpdateValues {
  name: string;
  code: string;
  categoryId?: number;
  /** Only explicitly edited catalog-backed custom fields are present. */
  customFields?: CustomFieldValues;
  /** Only explicitly edited, target-bound FILE fields are present. Empty values clear that field. */
  fileFields?: Readonly<Record<string, readonly number[]>>;
  unit?: string;
  listPrice: number;
  description?: string;
}

export type ProductEditableBaseline = components["schemas"]["ProductEditableBaselineResponse"];

export type CompleteProductEditableBaseline = ProductEditableBaseline & {
  editable: true;
  id: number;
  version: number;
  name: string;
  code: string;
  listPrice: number;
};

function isPositiveIdentifier(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isOptionalText(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalCategoryId(value: unknown): value is number | undefined {
  return value === undefined || isPositiveIdentifier(value);
}

/**
 * Accepts the server's purpose-built baseline only when its shape preserves the
 * no-leak contract. A non-editable baseline must not contain business fields.
 */
export function toProductEditableBaseline(value: unknown): ProductEditableBaseline | null {
  const source = recordOf(value);
  if (
    source === null ||
    !isPositiveIdentifier(source.id) ||
    !isVersion(source.version) ||
    typeof source.editable !== "boolean"
  ) {
    return null;
  }

  const businessFieldNames = [
    "name",
    "code",
    "categoryId",
    "unit",
    "listPrice",
    "description",
  ] as const;
  if (!source.editable) {
    return businessFieldNames.some((fieldName) => fieldName in source)
      ? null
      : { editable: false, id: source.id, version: source.version };
  }

  if (
    typeof source.name !== "string" ||
    source.name.trim().length === 0 ||
    typeof source.code !== "string" ||
    source.code.trim().length === 0 ||
    typeof source.listPrice !== "number" ||
    !Number.isFinite(source.listPrice) ||
    source.listPrice < 0 ||
    !isOptionalCategoryId(source.categoryId) ||
    !isOptionalText(source.unit) ||
    !isOptionalText(source.description)
  ) {
    return null;
  }

  return {
    categoryId: source.categoryId,
    code: source.code,
    description: source.description,
    editable: true,
    id: source.id,
    listPrice: source.listPrice,
    name: source.name,
    unit: source.unit,
    version: source.version,
  };
}

export function isCompleteProductEditableBaseline(
  baseline: ProductEditableBaseline,
): baseline is CompleteProductEditableBaseline {
  return baseline.editable;
}

export function productUpdateValuesFromBaseline(
  baseline: CompleteProductEditableBaseline,
): ProductUpdateValues {
  return {
    categoryId: baseline.categoryId,
    code: baseline.code,
    description: baseline.description,
    listPrice: baseline.listPrice,
    name: baseline.name,
    unit: baseline.unit,
  };
}

/**
 * Keeps a product PATCH-shaped custom-field change set separate from the
 * detail projection. Empty arrays are intentional: they clear only a field
 * the user explicitly touched; omitted codes keep their server value.
 */
export function toProductCustomFieldUpdateValues(
  definitions: readonly FieldDefinition[],
  values: CustomFieldValues,
  changedCodes: ReadonlySet<string>,
): CustomFieldValues {
  const definitionsByCode = new Map(definitions.map((definition) => [definition.code, definition]));
  return Object.fromEntries(
    [...changedCodes].flatMap((code) => {
      const definition = definitionsByCode.get(code);
      if (definition === undefined) return [];

      const normalized =
        toCustomFieldFormValues([definition], {
          [code]: values[code] ?? [],
        })[code] ?? [];
      return [[code, normalized]];
    }),
  );
}

/** Sends the minimum server-required product fields without deriving amounts. */
export function toProductCreateRequest(
  values: ProductCreateValues,
): components["schemas"]["ProductCreateRequest"] {
  const unit = values.unit?.trim();
  const description = values.description?.trim();
  const customFields = Object.fromEntries(
    Object.entries(values.customFields ?? {}).flatMap(([code, fieldValues]) => {
      const normalized = [...new Set(fieldValues.map((value) => value.trim()).filter(Boolean))];
      return normalized.length === 0 ? [] : [[code, normalized]];
    }),
  );

  const request: components["schemas"]["ProductCreateRequest"] = {
    availability: values.availability,
    ...(values.categoryId === undefined ? {} : { categoryId: values.categoryId }),
    code: values.code.trim(),
    ...(description ? { description } : {}),
    listPrice: values.listPrice,
    name: values.name.trim(),
    ...(values.ownerActorId === undefined ? {} : { ownerActorId: values.ownerActorId }),
    ...(unit ? { unit } : {}),
  };
  if (Object.keys(customFields).length > 0) request.customFields = customFields;
  if (
    values.fileFieldSubmission !== undefined &&
    Number.isSafeInteger(values.fileFieldSubmission.draftId) &&
    values.fileFieldSubmission.draftId > 0
  ) {
    const fileFields = Object.fromEntries(
      Object.entries(values.fileFieldSubmission.fields).flatMap(([code, fileIds]) => {
        const normalized = [...new Set(fileIds)].filter(
          (fileId) => Number.isSafeInteger(fileId) && fileId > 0,
        );
        return normalized.length === 0 ? [] : [[code, normalized]];
      }),
    );
    if (Object.keys(fileFields).length > 0) {
      request.fileFieldDraftId = values.fileFieldSubmission.draftId;
      request.fileFields = fileFields;
    }
  }
  if (
    values.productImageSubmission !== undefined &&
    Number.isSafeInteger(values.productImageSubmission.draftId) &&
    values.productImageSubmission.draftId > 0
  ) {
    const productImages = Object.fromEntries(
      (["PRIMARY", "DETAIL"] as const).flatMap((imageType) => {
        const fileIds = values.productImageSubmission?.images[imageType] ?? [];
        const normalized = [...new Set(fileIds)].filter(
          (fileId) => Number.isSafeInteger(fileId) && fileId > 0,
        );
        return normalized.length === 0 ? [] : [[imageType, normalized]];
      }),
    );
    if (Object.keys(productImages).length > 0) {
      request.productImageDraftId = values.productImageSubmission.draftId;
      request.productImages = productImages;
    }
  }
  return request;
}

/**
 * Product PUT replaces its base fields. Values are sourced exclusively from
 * the authoritative editable baseline and this form; detail projections never
 * participate in constructing this request.
 */
export function toProductUpdateRequest(
  values: ProductUpdateValues,
  baseline: CompleteProductEditableBaseline,
): components["schemas"]["ProductUpdateRequest"] {
  const request: components["schemas"]["ProductUpdateRequest"] = {
    categoryId: values.categoryId,
    code: values.code.trim(),
    description: values.description?.trim() || undefined,
    listPrice: values.listPrice,
    name: values.name.trim(),
    unit: values.unit?.trim() || undefined,
    version: baseline.version,
  };
  if (values.customFields !== undefined) {
    request.customFields = Object.fromEntries(
      Object.entries(values.customFields).map(([code, fieldValues]) => [
        code,
        [...new Set(fieldValues.map((value) => value.trim()).filter(Boolean))],
      ]),
    );
  }
  if (values.fileFields !== undefined) {
    const fileFields = Object.fromEntries(
      Object.entries(values.fileFields).flatMap(([code, fileIds]) => {
        if (!/^[a-z][a-z0-9_]{1,63}$/.test(code)) return [];
        return [
          [
            code,
            [...new Set(fileIds)].filter((fileId) => Number.isSafeInteger(fileId) && fileId > 0),
          ],
        ];
      }),
    );
    if (Object.keys(fileFields).length > 0) request.fileFields = fileFields;
  }
  return request;
}
