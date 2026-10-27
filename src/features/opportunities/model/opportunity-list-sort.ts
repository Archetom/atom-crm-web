import type { components } from "~/api/generated/schema";
import type { FieldDefinition } from "~/components/dynamic-field";

type StaticOpportunityListSort =
  | "updated-desc"
  | "updated-asc"
  | "created-desc"
  | "created-asc"
  | "name-asc"
  | "name-desc"
  | "owner-asc"
  | "owner-desc";

export type OpportunityListSort =
  StaticOpportunityListSort | `custom:${string}:asc` | `custom:${string}:desc`;

type OpportunityListSortQuery = Pick<
  components["schemas"]["OpportunityQueryRequest"],
  "customSortFieldCode" | "sortDirection" | "sortField"
>;

export interface OpportunityListSortOption {
  label: string;
  value: OpportunityListSort;
}

export const defaultOpportunityListSort: OpportunityListSort = "updated-desc";

export const opportunityListSortOptions: readonly OpportunityListSortOption[] = [
  { label: "最近更新", value: "updated-desc" },
  { label: "最早更新", value: "updated-asc" },
  { label: "最新创建", value: "created-desc" },
  { label: "最早创建", value: "created-asc" },
  { label: "商机名称 A–Z", value: "name-asc" },
  { label: "商机名称 Z–A", value: "name-desc" },
  { label: "负责人 ID 升序", value: "owner-asc" },
  { label: "负责人 ID 降序", value: "owner-desc" },
];

const queryBySort: Readonly<Record<StaticOpportunityListSort, OpportunityListSortQuery>> = {
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

interface CustomOpportunityListSort {
  fieldCode: string;
  direction: "ASC" | "DESC";
}

export function opportunityListSortFromSearch(search: string): OpportunityListSort {
  const sort = new URLSearchParams(search).get("sort");
  return isOpportunityListSort(sort) ? sort : defaultOpportunityListSort;
}

export function withOpportunityListSort<T extends object>(
  query: T,
  sort: OpportunityListSort,
): T & OpportunityListSortQuery {
  if (isStaticOpportunityListSort(sort)) {
    return { ...query, ...queryBySort[sort] };
  }

  const customSort = parseCustomOpportunityListSort(sort);
  return customSort === null
    ? { ...query }
    : {
        ...query,
        customSortFieldCode: customSort.fieldCode,
        sortDirection: customSort.direction,
      };
}

export function opportunityListSortLabel(
  sort: OpportunityListSort,
  fields: readonly FieldDefinition[] = [],
): string {
  const customSort = parseCustomOpportunityListSort(sort);
  if (customSort !== null) {
    const field = fields.find((candidate) => candidate.code === customSort.fieldCode);
    return `${field?.displayName ?? "自定义字段"}：${customSort.direction === "ASC" ? "升序" : "降序"}`;
  }
  return opportunityListSortOptions.find((option) => option.value === sort)?.label ?? "最近更新";
}

/** The current field catalogue only controls offered choices; server policy remains authoritative. */
export function isOpportunityCustomSortableField(field: FieldDefinition): boolean {
  return (
    !field.builtin && field.status === "ACTIVE" && sortableCustomFieldTypes.has(field.fieldType)
  );
}

export function opportunityCustomSortOptions(
  fields: readonly FieldDefinition[],
): readonly OpportunityListSortOption[] {
  return fields.flatMap((field) => {
    if (!isOpportunityCustomSortableField(field)) return [];

    return [
      { label: `${field.displayName}：升序`, value: `custom:${field.code}:asc` },
      { label: `${field.displayName}：降序`, value: `custom:${field.code}:desc` },
    ];
  });
}

export function resolveOpportunityListSort(
  sort: OpportunityListSort,
  fields: readonly FieldDefinition[],
): OpportunityListSort {
  const customSort = parseCustomOpportunityListSort(sort);
  if (customSort === null) return sort;

  return fields.some(
    (field) => field.code === customSort.fieldCode && isOpportunityCustomSortableField(field),
  )
    ? sort
    : defaultOpportunityListSort;
}

function isOpportunityListSort(value: string | null): value is OpportunityListSort {
  return (
    (value !== null && isStaticOpportunityListSort(value)) ||
    parseCustomOpportunityListSort(value) !== null
  );
}

function isStaticOpportunityListSort(value: string): value is StaticOpportunityListSort {
  return opportunityListSortOptions.some((option) => option.value === value);
}

function parseCustomOpportunityListSort(value: string | null): CustomOpportunityListSort | null {
  if (value === null) return null;

  const match = customSortPattern.exec(value);
  if (match === null) return null;

  return {
    fieldCode: match[1],
    direction: match[2] === "asc" ? "ASC" : "DESC",
  };
}
