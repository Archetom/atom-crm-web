import type { components } from "~/api/generated/schema";
import type { FieldDefinition } from "~/components/dynamic-field";

type StaticReturnVisitListSort =
  | "visit-time-desc"
  | "visit-time-asc"
  | "updated-desc"
  | "updated-asc"
  | "created-desc"
  | "created-asc"
  | "number-asc"
  | "number-desc"
  | "owner-asc"
  | "owner-desc";

export type ReturnVisitListSort =
  StaticReturnVisitListSort | `custom:${string}:asc` | `custom:${string}:desc`;

type ReturnVisitListSortQuery = Pick<
  components["schemas"]["ReturnVisitQueryRequest"],
  "customSortFieldCode" | "sortDirection" | "sortField"
>;

export interface ReturnVisitListSortOption {
  label: string;
  value: ReturnVisitListSort;
}

export const defaultReturnVisitListSort: ReturnVisitListSort = "visit-time-desc";

export const returnVisitListSortOptions: readonly ReturnVisitListSortOption[] = [
  { label: "回访时间（新到旧）", value: "visit-time-desc" },
  { label: "回访时间（旧到新）", value: "visit-time-asc" },
  { label: "最近更新", value: "updated-desc" },
  { label: "最早更新", value: "updated-asc" },
  { label: "最新创建", value: "created-desc" },
  { label: "最早创建", value: "created-asc" },
  { label: "回访编号 A–Z", value: "number-asc" },
  { label: "回访编号 Z–A", value: "number-desc" },
  { label: "负责人 ID 升序", value: "owner-asc" },
  { label: "负责人 ID 降序", value: "owner-desc" },
];

const queryBySort: Readonly<Record<StaticReturnVisitListSort, ReturnVisitListSortQuery>> = {
  "visit-time-desc": {},
  "visit-time-asc": { sortDirection: "ASC", sortField: "VISIT_TIME" },
  "updated-desc": { sortDirection: "DESC", sortField: "UPDATED_TIME" },
  "updated-asc": { sortDirection: "ASC", sortField: "UPDATED_TIME" },
  "created-desc": { sortDirection: "DESC", sortField: "CREATED_TIME" },
  "created-asc": { sortDirection: "ASC", sortField: "CREATED_TIME" },
  "number-asc": { sortDirection: "ASC", sortField: "VISIT_NUMBER" },
  "number-desc": { sortDirection: "DESC", sortField: "VISIT_NUMBER" },
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

interface CustomReturnVisitListSort {
  direction: "ASC" | "DESC";
  fieldCode: string;
}

export function returnVisitListSortFromSearch(search: string): ReturnVisitListSort {
  const sort = new URLSearchParams(search).get("sort");
  return isReturnVisitListSort(sort) ? sort : defaultReturnVisitListSort;
}

export function withReturnVisitListSort<T extends object>(
  query: T,
  sort: ReturnVisitListSort,
): T & ReturnVisitListSortQuery {
  if (isStaticReturnVisitListSort(sort)) {
    return { ...query, ...queryBySort[sort] };
  }

  const customSort = parseCustomReturnVisitListSort(sort);
  return customSort === null
    ? { ...query }
    : {
        ...query,
        customSortFieldCode: customSort.fieldCode,
        sortDirection: customSort.direction,
      };
}

export function returnVisitListSortLabel(
  sort: ReturnVisitListSort,
  fields: readonly FieldDefinition[] = [],
): string {
  const customSort = parseCustomReturnVisitListSort(sort);
  if (customSort !== null) {
    const field = fields.find((candidate) => candidate.code === customSort.fieldCode);
    return `${field?.displayName ?? "自定义字段"}：${customSort.direction === "ASC" ? "升序" : "降序"}`;
  }
  return (
    returnVisitListSortOptions.find((option) => option.value === sort)?.label ??
    "回访时间（新到旧）"
  );
}

/** The field catalogue only controls selectable UI options; server authorization stays decisive. */
export function isReturnVisitCustomSortableField(field: FieldDefinition): boolean {
  return (
    !field.builtin && field.status === "ACTIVE" && sortableCustomFieldTypes.has(field.fieldType)
  );
}

export function returnVisitCustomSortOptions(
  fields: readonly FieldDefinition[],
): readonly ReturnVisitListSortOption[] {
  return fields.flatMap((field) => {
    if (!isReturnVisitCustomSortableField(field)) return [];

    return [
      { label: `${field.displayName}：升序`, value: `custom:${field.code}:asc` },
      { label: `${field.displayName}：降序`, value: `custom:${field.code}:desc` },
    ];
  });
}

export function resolveReturnVisitListSort(
  sort: ReturnVisitListSort,
  fields: readonly FieldDefinition[],
): ReturnVisitListSort {
  const customSort = parseCustomReturnVisitListSort(sort);
  if (customSort === null) return sort;

  return fields.some(
    (field) => field.code === customSort.fieldCode && isReturnVisitCustomSortableField(field),
  )
    ? sort
    : defaultReturnVisitListSort;
}

function isReturnVisitListSort(value: string | null): value is ReturnVisitListSort {
  return (
    (value !== null && isStaticReturnVisitListSort(value)) ||
    parseCustomReturnVisitListSort(value) !== null
  );
}

function isStaticReturnVisitListSort(value: string): value is StaticReturnVisitListSort {
  return returnVisitListSortOptions.some((option) => option.value === value);
}

function parseCustomReturnVisitListSort(value: string | null): CustomReturnVisitListSort | null {
  if (value === null) return null;

  const match = customSortPattern.exec(value);
  if (match === null) return null;

  return {
    direction: match[2] === "asc" ? "ASC" : "DESC",
    fieldCode: match[1],
  };
}
