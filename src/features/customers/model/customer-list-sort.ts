import type { components } from "~/api/generated/schema";
import type { FieldDefinition } from "~/components/dynamic-field";

type StaticCustomerListSort =
  | "updated-desc"
  | "updated-asc"
  | "created-desc"
  | "created-asc"
  | "name-asc"
  | "name-desc"
  | "owner-asc"
  | "owner-desc";

export type CustomerListSort =
  StaticCustomerListSort | `custom:${string}:asc` | `custom:${string}:desc`;

type CustomerListSortQuery = Pick<
  components["schemas"]["CustomerQueryRequest"],
  "customSortFieldCode" | "sortDirection" | "sortField"
>;

export interface CustomerListSortOption {
  label: string;
  value: CustomerListSort;
}

export const defaultCustomerListSort: CustomerListSort = "updated-desc";

export const customerListSortOptions: readonly CustomerListSortOption[] = [
  { label: "最近更新", value: "updated-desc" },
  { label: "最早更新", value: "updated-asc" },
  { label: "最新创建", value: "created-desc" },
  { label: "最早创建", value: "created-asc" },
  { label: "客户名称 A–Z", value: "name-asc" },
  { label: "客户名称 Z–A", value: "name-desc" },
  { label: "负责人 ID 升序", value: "owner-asc" },
  { label: "负责人 ID 降序", value: "owner-desc" },
];

const queryBySort: Readonly<Record<StaticCustomerListSort, CustomerListSortQuery>> = {
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

interface CustomCustomerListSort {
  fieldCode: string;
  direction: "ASC" | "DESC";
}

export function customerListSortFromSearch(search: string): CustomerListSort {
  const sort = new URLSearchParams(search).get("sort");
  return isCustomerListSort(sort) ? sort : defaultCustomerListSort;
}

export function withCustomerListSort<T extends object>(
  query: T,
  sort: CustomerListSort,
): T & CustomerListSortQuery {
  if (isStaticCustomerListSort(sort)) {
    return { ...query, ...queryBySort[sort] };
  }

  const customSort = parseCustomCustomerListSort(sort);
  return customSort === null
    ? { ...query }
    : {
        ...query,
        customSortFieldCode: customSort.fieldCode,
        sortDirection: customSort.direction,
      };
}

export function customerListSortLabel(
  sort: CustomerListSort,
  fields: readonly FieldDefinition[] = [],
): string {
  const customSort = parseCustomCustomerListSort(sort);
  if (customSort !== null) {
    const field = fields.find((candidate) => candidate.code === customSort.fieldCode);
    return `${field?.displayName ?? "自定义字段"}：${customSort.direction === "ASC" ? "升序" : "降序"}`;
  }
  return customerListSortOptions.find((option) => option.value === sort)?.label ?? "最近更新";
}

/**
 * A custom field is only offered after the current server-provided field
 * catalogue has confirmed that it is active and scalar. The server remains
 * authoritative for field access and masking when it resolves the request.
 */
export function isCustomerCustomSortableField(field: FieldDefinition): boolean {
  return (
    !field.builtin && field.status === "ACTIVE" && sortableCustomFieldTypes.has(field.fieldType)
  );
}

export function customerCustomSortOptions(
  fields: readonly FieldDefinition[],
): readonly CustomerListSortOption[] {
  return fields.flatMap((field) => {
    if (!isCustomerCustomSortableField(field)) return [];

    return [
      { label: `${field.displayName}：升序`, value: `custom:${field.code}:asc` },
      { label: `${field.displayName}：降序`, value: `custom:${field.code}:desc` },
    ];
  });
}

export function resolveCustomerListSort(
  sort: CustomerListSort,
  fields: readonly FieldDefinition[],
): CustomerListSort {
  const customSort = parseCustomCustomerListSort(sort);
  if (customSort === null) return sort;

  return fields.some(
    (field) => field.code === customSort.fieldCode && isCustomerCustomSortableField(field),
  )
    ? sort
    : defaultCustomerListSort;
}

function isCustomerListSort(value: string | null): value is CustomerListSort {
  return (
    (value !== null && isStaticCustomerListSort(value)) ||
    parseCustomCustomerListSort(value) !== null
  );
}

function isStaticCustomerListSort(value: string): value is StaticCustomerListSort {
  return customerListSortOptions.some((option) => option.value === value);
}

function parseCustomCustomerListSort(value: string | null): CustomCustomerListSort | null {
  if (value === null) return null;

  const match = customSortPattern.exec(value);
  if (match === null) return null;

  return {
    fieldCode: match[1],
    direction: match[2] === "asc" ? "ASC" : "DESC",
  };
}
