import type { components } from "~/api/generated/schema";
import type { FieldDefinition } from "~/components/dynamic-field";

type StaticReceivableListSort =
  | "received-date-desc"
  | "received-date-asc"
  | "updated-desc"
  | "updated-asc"
  | "created-desc"
  | "created-asc"
  | "number-asc"
  | "number-desc"
  | "owner-asc"
  | "owner-desc";

export type ReceivableListSort =
  StaticReceivableListSort | `custom:${string}:asc` | `custom:${string}:desc`;

type ReceivableListSortQuery = Pick<
  components["schemas"]["ReceivableQueryRequest"],
  "customSortFieldCode" | "sortDirection" | "sortField"
>;

export interface ReceivableListSortOption {
  label: string;
  value: ReceivableListSort;
}

export const defaultReceivableListSort: ReceivableListSort = "received-date-desc";

export const receivableListSortOptions: readonly ReceivableListSortOption[] = [
  { label: "回款日期（新到旧）", value: "received-date-desc" },
  { label: "回款日期（旧到新）", value: "received-date-asc" },
  { label: "最近更新", value: "updated-desc" },
  { label: "最早更新", value: "updated-asc" },
  { label: "最新创建", value: "created-desc" },
  { label: "最早创建", value: "created-asc" },
  { label: "回款编号 A–Z", value: "number-asc" },
  { label: "回款编号 Z–A", value: "number-desc" },
  { label: "负责人 ID 升序", value: "owner-asc" },
  { label: "负责人 ID 降序", value: "owner-desc" },
];

const queryBySort: Readonly<Record<StaticReceivableListSort, ReceivableListSortQuery>> = {
  "received-date-desc": {},
  "received-date-asc": { sortDirection: "ASC", sortField: "RECEIVED_DATE" },
  "updated-desc": { sortDirection: "DESC", sortField: "UPDATED_TIME" },
  "updated-asc": { sortDirection: "ASC", sortField: "UPDATED_TIME" },
  "created-desc": { sortDirection: "DESC", sortField: "CREATED_TIME" },
  "created-asc": { sortDirection: "ASC", sortField: "CREATED_TIME" },
  "number-asc": { sortDirection: "ASC", sortField: "RECEIPT_NUMBER" },
  "number-desc": { sortDirection: "DESC", sortField: "RECEIPT_NUMBER" },
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

interface CustomReceivableListSort {
  direction: "ASC" | "DESC";
  fieldCode: string;
}

export function receivableListSortFromSearch(search: string): ReceivableListSort {
  const sort = new URLSearchParams(search).get("sort");
  return isReceivableListSort(sort) ? sort : defaultReceivableListSort;
}

export function withReceivableListSort<T extends object>(
  query: T,
  sort: ReceivableListSort,
): T & ReceivableListSortQuery {
  if (isStaticReceivableListSort(sort)) {
    return { ...query, ...queryBySort[sort] };
  }

  const customSort = parseCustomReceivableListSort(sort);
  return customSort === null
    ? { ...query }
    : {
        ...query,
        customSortFieldCode: customSort.fieldCode,
        sortDirection: customSort.direction,
      };
}

export function receivableListSortLabel(
  sort: ReceivableListSort,
  fields: readonly FieldDefinition[] = [],
): string {
  const customSort = parseCustomReceivableListSort(sort);
  if (customSort !== null) {
    const field = fields.find((candidate) => candidate.code === customSort.fieldCode);
    return `${field?.displayName ?? "自定义字段"}：${customSort.direction === "ASC" ? "升序" : "降序"}`;
  }
  return (
    receivableListSortOptions.find((option) => option.value === sort)?.label ?? "回款日期（新到旧）"
  );
}

/** The field catalogue only controls selectable UI options; server authorization stays decisive. */
export function isReceivableCustomSortableField(field: FieldDefinition): boolean {
  return (
    !field.builtin && field.status === "ACTIVE" && sortableCustomFieldTypes.has(field.fieldType)
  );
}

export function receivableCustomSortOptions(
  fields: readonly FieldDefinition[],
): readonly ReceivableListSortOption[] {
  return fields.flatMap((field) => {
    if (!isReceivableCustomSortableField(field)) return [];

    return [
      { label: `${field.displayName}：升序`, value: `custom:${field.code}:asc` },
      { label: `${field.displayName}：降序`, value: `custom:${field.code}:desc` },
    ];
  });
}

export function resolveReceivableListSort(
  sort: ReceivableListSort,
  fields: readonly FieldDefinition[],
): ReceivableListSort {
  const customSort = parseCustomReceivableListSort(sort);
  if (customSort === null) return sort;

  return fields.some(
    (field) => field.code === customSort.fieldCode && isReceivableCustomSortableField(field),
  )
    ? sort
    : defaultReceivableListSort;
}

function isReceivableListSort(value: string | null): value is ReceivableListSort {
  return (
    (value !== null && isStaticReceivableListSort(value)) ||
    parseCustomReceivableListSort(value) !== null
  );
}

function isStaticReceivableListSort(value: string): value is StaticReceivableListSort {
  return receivableListSortOptions.some((option) => option.value === value);
}

function parseCustomReceivableListSort(value: string | null): CustomReceivableListSort | null {
  if (value === null) return null;

  const match = customSortPattern.exec(value);
  if (match === null) return null;

  return {
    direction: match[2] === "asc" ? "ASC" : "DESC",
    fieldCode: match[1],
  };
}
