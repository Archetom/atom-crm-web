import type { components } from "~/api/generated/schema";
import type { FieldDefinition } from "~/components/dynamic-field";

type StaticLeadListSort =
  | "updated-desc"
  | "updated-asc"
  | "created-desc"
  | "created-asc"
  | "name-asc"
  | "name-desc"
  | "owner-asc"
  | "owner-desc";

export type LeadListSort = StaticLeadListSort | `custom:${string}:asc` | `custom:${string}:desc`;

type LeadListSortQuery = Pick<
  components["schemas"]["LeadQueryRequest"],
  "customSortFieldCode" | "sortDirection" | "sortField"
>;

export interface LeadListSortOption {
  label: string;
  value: LeadListSort;
}

export const defaultLeadListSort: LeadListSort = "updated-desc";

export const leadListSortOptions: readonly LeadListSortOption[] = [
  { label: "最近更新", value: "updated-desc" },
  { label: "最早更新", value: "updated-asc" },
  { label: "最新创建", value: "created-desc" },
  { label: "最早创建", value: "created-asc" },
  { label: "线索名称 A–Z", value: "name-asc" },
  { label: "线索名称 Z–A", value: "name-desc" },
  { label: "负责人 ID 升序", value: "owner-asc" },
  { label: "负责人 ID 降序", value: "owner-desc" },
];

const queryBySort: Readonly<Record<StaticLeadListSort, LeadListSortQuery>> = {
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

interface CustomLeadListSort {
  fieldCode: string;
  direction: "ASC" | "DESC";
}

export function leadListSortFromSearch(search: string): LeadListSort {
  const sort = new URLSearchParams(search).get("sort");
  return isLeadListSort(sort) ? sort : defaultLeadListSort;
}

export function withLeadListSort<T extends object>(
  query: T,
  sort: LeadListSort,
): T & LeadListSortQuery {
  if (isStaticLeadListSort(sort)) {
    return { ...query, ...queryBySort[sort] };
  }

  const customSort = parseCustomLeadListSort(sort);
  return customSort === null
    ? { ...query }
    : {
        ...query,
        customSortFieldCode: customSort.fieldCode,
        sortDirection: customSort.direction,
      };
}

export function leadListSortLabel(
  sort: LeadListSort,
  fields: readonly FieldDefinition[] = [],
): string {
  const customSort = parseCustomLeadListSort(sort);
  if (customSort !== null) {
    const field = fields.find((candidate) => candidate.code === customSort.fieldCode);
    return `${field?.displayName ?? "自定义字段"}：${customSort.direction === "ASC" ? "升序" : "降序"}`;
  }
  return leadListSortOptions.find((option) => option.value === sort)?.label ?? "最近更新";
}

/** The current field catalogue only controls offered choices; server policy remains authoritative. */
export function isLeadCustomSortableField(field: FieldDefinition): boolean {
  return (
    !field.builtin && field.status === "ACTIVE" && sortableCustomFieldTypes.has(field.fieldType)
  );
}

export function leadCustomSortOptions(
  fields: readonly FieldDefinition[],
): readonly LeadListSortOption[] {
  return fields.flatMap((field) => {
    if (!isLeadCustomSortableField(field)) return [];

    return [
      { label: `${field.displayName}：升序`, value: `custom:${field.code}:asc` },
      { label: `${field.displayName}：降序`, value: `custom:${field.code}:desc` },
    ];
  });
}

export function resolveLeadListSort(
  sort: LeadListSort,
  fields: readonly FieldDefinition[],
): LeadListSort {
  const customSort = parseCustomLeadListSort(sort);
  if (customSort === null) return sort;

  return fields.some(
    (field) => field.code === customSort.fieldCode && isLeadCustomSortableField(field),
  )
    ? sort
    : defaultLeadListSort;
}

function isLeadListSort(value: string | null): value is LeadListSort {
  return (value !== null && isStaticLeadListSort(value)) || parseCustomLeadListSort(value) !== null;
}

function isStaticLeadListSort(value: string): value is StaticLeadListSort {
  return leadListSortOptions.some((option) => option.value === value);
}

function parseCustomLeadListSort(value: string | null): CustomLeadListSort | null {
  if (value === null) return null;

  const match = customSortPattern.exec(value);
  if (match === null) return null;

  return {
    fieldCode: match[1],
    direction: match[2] === "asc" ? "ASC" : "DESC",
  };
}
