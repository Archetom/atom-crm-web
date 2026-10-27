import type { components } from "~/api/generated/schema";
import type { FieldDefinition } from "~/components/dynamic-field";

type StaticContractListSort =
  | "updated-desc"
  | "updated-asc"
  | "created-desc"
  | "created-asc"
  | "name-asc"
  | "name-desc"
  | "owner-asc"
  | "owner-desc";

export type ContractListSort =
  StaticContractListSort | `custom:${string}:asc` | `custom:${string}:desc`;

type ContractListSortQuery = Pick<
  components["schemas"]["ContractQueryRequest"],
  "customSortFieldCode" | "sortDirection" | "sortField"
>;

export interface ContractListSortOption {
  label: string;
  value: ContractListSort;
}

export const defaultContractListSort: ContractListSort = "updated-desc";

export const contractListSortOptions: readonly ContractListSortOption[] = [
  { label: "最近更新", value: "updated-desc" },
  { label: "最早更新", value: "updated-asc" },
  { label: "最新创建", value: "created-desc" },
  { label: "最早创建", value: "created-asc" },
  { label: "合同名称 A–Z", value: "name-asc" },
  { label: "合同名称 Z–A", value: "name-desc" },
  { label: "负责人 ID 升序", value: "owner-asc" },
  { label: "负责人 ID 降序", value: "owner-desc" },
];

const queryBySort: Readonly<Record<StaticContractListSort, ContractListSortQuery>> = {
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

interface CustomContractListSort {
  direction: "ASC" | "DESC";
  fieldCode: string;
}

export function contractListSortFromSearch(search: string): ContractListSort {
  const sort = new URLSearchParams(search).get("sort");
  return isContractListSort(sort) ? sort : defaultContractListSort;
}

export function withContractListSort<T extends object>(
  query: T,
  sort: ContractListSort,
): T & ContractListSortQuery {
  if (isStaticContractListSort(sort)) return { ...query, ...queryBySort[sort] };

  const customSort = parseCustomContractListSort(sort);
  return customSort === null
    ? { ...query }
    : {
        ...query,
        customSortFieldCode: customSort.fieldCode,
        sortDirection: customSort.direction,
      };
}

export function contractListSortLabel(
  sort: ContractListSort,
  fields: readonly FieldDefinition[] = [],
): string {
  const customSort = parseCustomContractListSort(sort);
  if (customSort !== null) {
    const field = fields.find((candidate) => candidate.code === customSort.fieldCode);
    return `${field?.displayName ?? "自定义字段"}：${customSort.direction === "ASC" ? "升序" : "降序"}`;
  }
  return contractListSortOptions.find((option) => option.value === sort)?.label ?? "最近更新";
}

export function isContractCustomSortableField(field: FieldDefinition): boolean {
  return (
    !field.builtin && field.status === "ACTIVE" && sortableCustomFieldTypes.has(field.fieldType)
  );
}

export function contractCustomSortOptions(
  fields: readonly FieldDefinition[],
): readonly ContractListSortOption[] {
  return fields.flatMap((field) => {
    if (!isContractCustomSortableField(field)) return [];

    return [
      { label: `${field.displayName}：升序`, value: `custom:${field.code}:asc` },
      { label: `${field.displayName}：降序`, value: `custom:${field.code}:desc` },
    ];
  });
}

export function resolveContractListSort(
  sort: ContractListSort,
  fields: readonly FieldDefinition[],
): ContractListSort {
  const customSort = parseCustomContractListSort(sort);
  if (customSort === null) return sort;
  return fields.some(
    (field) => field.code === customSort.fieldCode && isContractCustomSortableField(field),
  )
    ? sort
    : defaultContractListSort;
}

function isContractListSort(value: string | null): value is ContractListSort {
  return (
    (value !== null && isStaticContractListSort(value)) ||
    parseCustomContractListSort(value) !== null
  );
}

function isStaticContractListSort(value: string): value is StaticContractListSort {
  return contractListSortOptions.some((option) => option.value === value);
}

function parseCustomContractListSort(value: string | null): CustomContractListSort | null {
  if (value === null) return null;
  const match = customSortPattern.exec(value);
  if (match === null) return null;
  return { direction: match[2] === "asc" ? "ASC" : "DESC", fieldCode: match[1] };
}
