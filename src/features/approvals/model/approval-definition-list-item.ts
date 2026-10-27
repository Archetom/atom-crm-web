import { recordOf } from "~/shared/utils/decode";

export const approvalDefinitionObjectTypes = [
  "LEAD",
  "CUSTOMER",
  "CONTACT",
  "PRODUCT",
  "OPPORTUNITY",
  "CONTRACT",
  "RECEIVABLE",
  "RECEIVABLE_PLAN",
  "RETURN_VISIT",
  "INVOICE",
  "OA_REQUEST",
] as const;
export const approvalDefinitionStatuses = ["ACTIVE", "INACTIVE", "DELETED"] as const;

export type ApprovalDefinitionObjectType = (typeof approvalDefinitionObjectTypes)[number];
export type ApprovalDefinitionStatus = (typeof approvalDefinitionStatuses)[number];

export interface ApprovalDefinitionListItem {
  id: number;
  name: string;
  objectType: ApprovalDefinitionObjectType;
  status: ApprovalDefinitionStatus;
}

export interface ApprovalDefinitionPage {
  items: ApprovalDefinitionListItem[];
  total: number | null;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function pageTotal(value: unknown): number | null | undefined {
  if (value === -1) return null;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

/** Drops routing steps, conditions, member scopes, repeat modes, versions, and timestamps. */
export function toApprovalDefinitionListItem(value: unknown): ApprovalDefinitionListItem | null {
  const source = recordOf(value);
  const id = source === null ? null : positiveIdentifier(source.id);
  if (
    source === null ||
    id === null ||
    typeof source.name !== "string" ||
    source.name.trim().length === 0 ||
    !isOneOf(source.objectType, approvalDefinitionObjectTypes) ||
    !isOneOf(source.status, approvalDefinitionStatuses)
  ) {
    return null;
  }

  return { id, name: source.name, objectType: source.objectType, status: source.status };
}

/** Decodes an approval-definition page before it enters the client-side server-data cache. */
export function toApprovalDefinitionPage(value: unknown): ApprovalDefinitionPage | null {
  const source = recordOf(value);
  const total = source === null ? undefined : pageTotal(source.totalNum);
  if (source === null || !Array.isArray(source.objectList) || total === undefined) return null;

  return {
    items: source.objectList.flatMap((item) => {
      const definition = toApprovalDefinitionListItem(item);
      return definition === null ? [] : [definition];
    }),
    total,
  };
}
