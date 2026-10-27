import type { components } from "~/api/generated/schema";
import type { FieldDefinition } from "~/components/dynamic-field";

type StaticContactListSort =
  | "updated-desc"
  | "updated-asc"
  | "created-desc"
  | "created-asc"
  | "name-asc"
  | "name-desc"
  | "owner-asc"
  | "owner-desc";

export type ContactListSort =
  StaticContactListSort | `custom:${string}:asc` | `custom:${string}:desc`;

type ContactListSortQuery = Pick<
  components["schemas"]["ContactQueryRequest"],
  "customSortFieldCode" | "sortDirection" | "sortField"
>;

export interface ContactListSortOption {
  label: string;
  value: ContactListSort;
}

export const defaultContactListSort: ContactListSort = "updated-desc";

export const contactListSortOptions: readonly ContactListSortOption[] = [
  { label: "最近更新", value: "updated-desc" },
  { label: "最早更新", value: "updated-asc" },
  { label: "最新创建", value: "created-desc" },
  { label: "最早创建", value: "created-asc" },
  { label: "联系人姓名 A–Z", value: "name-asc" },
  { label: "联系人姓名 Z–A", value: "name-desc" },
  { label: "负责人 ID 升序", value: "owner-asc" },
  { label: "负责人 ID 降序", value: "owner-desc" },
];

const queryBySort: Readonly<Record<StaticContactListSort, ContactListSortQuery>> = {
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

interface CustomContactListSort {
  fieldCode: string;
  direction: "ASC" | "DESC";
}

export function contactListSortFromSearch(search: string): ContactListSort {
  const sort = new URLSearchParams(search).get("sort");
  return isContactListSort(sort) ? sort : defaultContactListSort;
}

export function withContactListSort<T extends object>(
  query: T,
  sort: ContactListSort,
): T & ContactListSortQuery {
  if (isStaticContactListSort(sort)) {
    return { ...query, ...queryBySort[sort] };
  }

  const customSort = parseCustomContactListSort(sort);
  return customSort === null
    ? { ...query }
    : {
        ...query,
        customSortFieldCode: customSort.fieldCode,
        sortDirection: customSort.direction,
      };
}

export function contactListSortLabel(
  sort: ContactListSort,
  fields: readonly FieldDefinition[] = [],
): string {
  const customSort = parseCustomContactListSort(sort);
  if (customSort !== null) {
    const field = fields.find((candidate) => candidate.code === customSort.fieldCode);
    return `${field?.displayName ?? "自定义字段"}：${customSort.direction === "ASC" ? "升序" : "降序"}`;
  }
  return contactListSortOptions.find((option) => option.value === sort)?.label ?? "最近更新";
}

/** The current field catalogue only controls offered choices; server policy remains authoritative. */
export function isContactCustomSortableField(field: FieldDefinition): boolean {
  return (
    !field.builtin && field.status === "ACTIVE" && sortableCustomFieldTypes.has(field.fieldType)
  );
}

export function contactCustomSortOptions(
  fields: readonly FieldDefinition[],
): readonly ContactListSortOption[] {
  return fields.flatMap((field) => {
    if (!isContactCustomSortableField(field)) return [];

    return [
      { label: `${field.displayName}：升序`, value: `custom:${field.code}:asc` },
      { label: `${field.displayName}：降序`, value: `custom:${field.code}:desc` },
    ];
  });
}

export function resolveContactListSort(
  sort: ContactListSort,
  fields: readonly FieldDefinition[],
): ContactListSort {
  const customSort = parseCustomContactListSort(sort);
  if (customSort === null) return sort;

  return fields.some(
    (field) => field.code === customSort.fieldCode && isContactCustomSortableField(field),
  )
    ? sort
    : defaultContactListSort;
}

function isContactListSort(value: string | null): value is ContactListSort {
  return (
    (value !== null && isStaticContactListSort(value)) || parseCustomContactListSort(value) !== null
  );
}

function isStaticContactListSort(value: string): value is StaticContactListSort {
  return contactListSortOptions.some((option) => option.value === value);
}

function parseCustomContactListSort(value: string | null): CustomContactListSort | null {
  if (value === null) return null;

  const match = customSortPattern.exec(value);
  if (match === null) return null;

  return {
    fieldCode: match[1],
    direction: match[2] === "asc" ? "ASC" : "DESC",
  };
}
