import type { components } from "~/api/generated/schema";
import type { FieldDefinition } from "~/components/dynamic-field";

type StaticInvoiceListSort =
  | "updated-desc"
  | "updated-asc"
  | "created-desc"
  | "created-asc"
  | "requested-date-desc"
  | "requested-date-asc"
  | "issued-date-desc"
  | "issued-date-asc"
  | "application-number-asc"
  | "application-number-desc"
  | "invoice-number-asc"
  | "invoice-number-desc"
  | "owner-asc"
  | "owner-desc";

export type InvoiceListSort =
  StaticInvoiceListSort | `custom:${string}:asc` | `custom:${string}:desc`;

type InvoiceListSortQuery = Pick<
  components["schemas"]["InvoiceQueryRequest"],
  "customSortFieldCode" | "sortDirection" | "sortField"
>;

export interface InvoiceListSortOption {
  label: string;
  value: InvoiceListSort;
}

export const defaultInvoiceListSort: InvoiceListSort = "updated-desc";

export const invoiceListSortOptions: readonly InvoiceListSortOption[] = [
  { label: "最近更新", value: "updated-desc" },
  { label: "最早更新", value: "updated-asc" },
  { label: "最新创建", value: "created-desc" },
  { label: "最早创建", value: "created-asc" },
  { label: "申请日期（新到旧）", value: "requested-date-desc" },
  { label: "申请日期（旧到新）", value: "requested-date-asc" },
  { label: "开票日期（新到旧）", value: "issued-date-desc" },
  { label: "开票日期（旧到新）", value: "issued-date-asc" },
  { label: "申请编号 A–Z", value: "application-number-asc" },
  { label: "申请编号 Z–A", value: "application-number-desc" },
  { label: "发票号码 A–Z", value: "invoice-number-asc" },
  { label: "发票号码 Z–A", value: "invoice-number-desc" },
  { label: "负责人 ID 升序", value: "owner-asc" },
  { label: "负责人 ID 降序", value: "owner-desc" },
];

const queryBySort: Readonly<Record<StaticInvoiceListSort, InvoiceListSortQuery>> = {
  "updated-desc": {},
  "updated-asc": { sortDirection: "ASC", sortField: "UPDATED_TIME" },
  "created-desc": { sortDirection: "DESC", sortField: "CREATED_TIME" },
  "created-asc": { sortDirection: "ASC", sortField: "CREATED_TIME" },
  "requested-date-desc": { sortDirection: "DESC", sortField: "REQUESTED_DATE" },
  "requested-date-asc": { sortDirection: "ASC", sortField: "REQUESTED_DATE" },
  "issued-date-desc": { sortDirection: "DESC", sortField: "ISSUED_DATE" },
  "issued-date-asc": { sortDirection: "ASC", sortField: "ISSUED_DATE" },
  "application-number-asc": { sortDirection: "ASC", sortField: "APPLICATION_NUMBER" },
  "application-number-desc": { sortDirection: "DESC", sortField: "APPLICATION_NUMBER" },
  "invoice-number-asc": { sortDirection: "ASC", sortField: "INVOICE_NUMBER" },
  "invoice-number-desc": { sortDirection: "DESC", sortField: "INVOICE_NUMBER" },
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

interface CustomInvoiceListSort {
  direction: "ASC" | "DESC";
  fieldCode: string;
}

export function invoiceListSortFromSearch(search: string): InvoiceListSort {
  const sort = new URLSearchParams(search).get("sort");
  return isInvoiceListSort(sort) ? sort : defaultInvoiceListSort;
}

export function withInvoiceListSort<T extends object>(
  query: T,
  sort: InvoiceListSort,
): T & InvoiceListSortQuery {
  if (isStaticInvoiceListSort(sort)) return { ...query, ...queryBySort[sort] };
  const customSort = parseCustomInvoiceListSort(sort);
  return customSort === null
    ? { ...query }
    : {
        ...query,
        customSortFieldCode: customSort.fieldCode,
        sortDirection: customSort.direction,
      };
}

export function invoiceListSortLabel(
  sort: InvoiceListSort,
  fields: readonly FieldDefinition[] = [],
): string {
  const customSort = parseCustomInvoiceListSort(sort);
  if (customSort !== null) {
    const field = fields.find((candidate) => candidate.code === customSort.fieldCode);
    return `${field?.displayName ?? "自定义字段"}：${customSort.direction === "ASC" ? "升序" : "降序"}`;
  }
  return invoiceListSortOptions.find((option) => option.value === sort)?.label ?? "最近更新";
}

export function isInvoiceCustomSortableField(field: FieldDefinition): boolean {
  return (
    !field.builtin && field.status === "ACTIVE" && sortableCustomFieldTypes.has(field.fieldType)
  );
}

export function invoiceCustomSortOptions(
  fields: readonly FieldDefinition[],
): readonly InvoiceListSortOption[] {
  return fields.flatMap((field) => {
    if (!isInvoiceCustomSortableField(field)) return [];
    return [
      { label: `${field.displayName}：升序`, value: `custom:${field.code}:asc` },
      { label: `${field.displayName}：降序`, value: `custom:${field.code}:desc` },
    ];
  });
}

export function resolveInvoiceListSort(
  sort: InvoiceListSort,
  fields: readonly FieldDefinition[],
): InvoiceListSort {
  const customSort = parseCustomInvoiceListSort(sort);
  if (customSort === null) return sort;
  return fields.some(
    (field) => field.code === customSort.fieldCode && isInvoiceCustomSortableField(field),
  )
    ? sort
    : defaultInvoiceListSort;
}

function isInvoiceListSort(value: string | null): value is InvoiceListSort {
  return (
    (value !== null && isStaticInvoiceListSort(value)) || parseCustomInvoiceListSort(value) !== null
  );
}

function isStaticInvoiceListSort(value: string): value is StaticInvoiceListSort {
  return invoiceListSortOptions.some((option) => option.value === value);
}

function parseCustomInvoiceListSort(value: string | null): CustomInvoiceListSort | null {
  if (value === null) return null;
  const match = customSortPattern.exec(value);
  if (match === null) return null;
  return { direction: match[2] === "asc" ? "ASC" : "DESC", fieldCode: match[1] };
}
