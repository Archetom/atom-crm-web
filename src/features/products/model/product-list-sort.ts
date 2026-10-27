import type { components } from "~/api/generated/schema";
import type { FieldDefinition } from "~/components/dynamic-field";

type StaticProductListSort =
  | "updated-desc"
  | "updated-asc"
  | "created-desc"
  | "created-asc"
  | "name-asc"
  | "name-desc"
  | "owner-asc"
  | "owner-desc";

export type ProductListSort =
  StaticProductListSort | `custom:${string}:asc` | `custom:${string}:desc`;

type ProductListSortQuery = Pick<
  components["schemas"]["ProductQueryRequest"],
  "customSortFieldCode" | "sortDirection" | "sortField"
>;

export interface ProductListSortOption {
  label: string;
  value: ProductListSort;
}

export const defaultProductListSort: ProductListSort = "updated-desc";

export const productListSortOptions: readonly ProductListSortOption[] = [
  { label: "最近更新", value: "updated-desc" },
  { label: "最早更新", value: "updated-asc" },
  { label: "最新创建", value: "created-desc" },
  { label: "最早创建", value: "created-asc" },
  { label: "产品名称 A–Z", value: "name-asc" },
  { label: "产品名称 Z–A", value: "name-desc" },
  { label: "负责人 ID 升序", value: "owner-asc" },
  { label: "负责人 ID 降序", value: "owner-desc" },
];

const queryBySort: Readonly<Record<StaticProductListSort, ProductListSortQuery>> = {
  "updated-desc": {},
  "updated-asc": { sortDirection: "ASC", sortField: "UPDATED_TIME" },
  "created-desc": { sortDirection: "DESC", sortField: "CREATED_TIME" },
  "created-asc": { sortDirection: "ASC", sortField: "CREATED_TIME" },
  "name-asc": { sortDirection: "ASC", sortField: "NAME" },
  "name-desc": { sortDirection: "DESC", sortField: "NAME" },
  "owner-asc": { sortDirection: "ASC", sortField: "OWNER_ACTOR" },
  "owner-desc": { sortDirection: "DESC", sortField: "OWNER_ACTOR" },
};

const sortableCustomFieldTypes = new Set<FieldDefinition["fieldType"]>([
  "TEXT",
  "TEXTAREA",
  "SELECT",
  "DATE",
  "DATETIME",
  "INTEGER",
  "DECIMAL",
  "BOOLEAN",
  "EMAIL",
  "PHONE",
  "URL",
]);

const customSortPattern = /^custom:([a-z][a-z0-9_]{1,63}):(asc|desc)$/;

interface CustomProductListSort {
  fieldCode: string;
  direction: "ASC" | "DESC";
}

export function productListSortFromSearch(search: string): ProductListSort {
  const sort = new URLSearchParams(search).get("sort");
  return isProductListSort(sort) ? sort : defaultProductListSort;
}

export function withProductListSort<T extends object>(
  query: T,
  sort: ProductListSort,
): T & ProductListSortQuery {
  if (isStaticProductListSort(sort)) {
    return { ...query, ...queryBySort[sort] };
  }

  const customSort = parseCustomProductListSort(sort);
  return customSort === null
    ? { ...query }
    : {
        ...query,
        customSortFieldCode: customSort.fieldCode,
        sortDirection: customSort.direction,
      };
}

export function productListSortLabel(
  sort: ProductListSort,
  fields: readonly FieldDefinition[] = [],
): string {
  const customSort = parseCustomProductListSort(sort);
  if (customSort !== null) {
    const field = fields.find((candidate) => candidate.code === customSort.fieldCode);
    return `${field?.displayName ?? "自定义字段"}：${customSort.direction === "ASC" ? "升序" : "降序"}`;
  }
  return productListSortOptions.find((option) => option.value === sort)?.label ?? "最近更新";
}

/** The current field catalogue only controls offered choices; server policy remains authoritative. */
export function isProductCustomSortableField(field: FieldDefinition): boolean {
  return (
    !field.builtin && field.status === "ACTIVE" && sortableCustomFieldTypes.has(field.fieldType)
  );
}

export function productCustomSortOptions(
  fields: readonly FieldDefinition[],
): readonly ProductListSortOption[] {
  return fields.flatMap((field) => {
    if (!isProductCustomSortableField(field)) return [];

    return [
      { label: `${field.displayName}：升序`, value: `custom:${field.code}:asc` },
      { label: `${field.displayName}：降序`, value: `custom:${field.code}:desc` },
    ];
  });
}

export function resolveProductListSort(
  sort: ProductListSort,
  fields: readonly FieldDefinition[],
): ProductListSort {
  const customSort = parseCustomProductListSort(sort);
  if (customSort === null) return sort;

  return fields.some(
    (field) => field.code === customSort.fieldCode && isProductCustomSortableField(field),
  )
    ? sort
    : defaultProductListSort;
}

function isProductListSort(value: string | null): value is ProductListSort {
  return (
    (value !== null && isStaticProductListSort(value)) || parseCustomProductListSort(value) !== null
  );
}

function isStaticProductListSort(value: string): value is StaticProductListSort {
  return productListSortOptions.some((option) => option.value === value);
}

function parseCustomProductListSort(value: string | null): CustomProductListSort | null {
  if (value === null) return null;

  const match = customSortPattern.exec(value);
  if (match === null) return null;

  return {
    fieldCode: match[1],
    direction: match[2] === "asc" ? "ASC" : "DESC",
  };
}
