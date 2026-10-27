import type { components } from "~/api/generated/schema";

import type { CustomerPoolStatus } from "./customer-pool-catalog";

export interface CustomerPoolConfiguration {
  id: number;
  name: string;
  status: CustomerPoolStatus;
  version: number;
  customerCount: number;
  administratorActorIds: readonly number[];
  eligibleActorIds: readonly number[];
  eligibleDepartmentIds: readonly number[];
  dailyClaimLimit: number;
  previousOwnerCooldownDays: number;
  automaticReleaseEnabled: boolean;
  rules: readonly CustomerPoolRule[];
  administrator: boolean;
}

export type CustomerPoolRuleType = "STALE_UPDATE" | "NOT_WON";

export interface CustomerPoolRule {
  type: CustomerPoolRuleType;
  inactiveDays: number;
}

function positiveIdentifier(value: number | undefined): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nonNegativeInteger(value: number | undefined): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function identifiers(value: readonly number[] | undefined): readonly number[] | null {
  if (value === undefined) return null;

  const seen = new Set<number>();
  const values: number[] = [];
  for (const item of value) {
    const identifier = positiveIdentifier(item);
    if (identifier === null || seen.has(identifier)) return null;
    seen.add(identifier);
    values.push(identifier);
  }
  return values;
}

function isStatus(value: string | undefined): value is CustomerPoolStatus {
  return value === "ACTIVE" || value === "INACTIVE" || value === "DELETED";
}

function isRuleType(value: string | undefined): value is CustomerPoolRuleType {
  return value === "STALE_UPDATE" || value === "NOT_WON";
}

function rules(
  value: readonly components["schemas"]["CustomerPoolRuleResponse"][] | undefined,
): readonly CustomerPoolRule[] | null {
  if (value === undefined || value.length > 10) return null;

  const known = new Set<CustomerPoolRuleType>();
  const result: CustomerPoolRule[] = [];
  for (const rule of value) {
    const inactiveDays = nonNegativeInteger(rule.inactiveDays);
    if (
      !isRuleType(rule.type) ||
      inactiveDays === null ||
      inactiveDays < 1 ||
      inactiveDays > 3650 ||
      known.has(rule.type)
    ) {
      return null;
    }
    known.add(rule.type);
    result.push({ type: rule.type, inactiveDays });
  }
  return result;
}

/** A narrow view of the generated configuration response used by this management list. */
export function toCustomerPoolConfiguration(
  value: components["schemas"]["CustomerPoolResponse"],
): CustomerPoolConfiguration | null {
  const id = positiveIdentifier(value.id);
  const version = nonNegativeInteger(value.version);
  const customerCount = nonNegativeInteger(value.customerCount);
  const administratorActorIds = identifiers(value.administratorActorIds);
  const eligibleActorIds = identifiers(value.eligibleActorIds);
  const eligibleDepartmentIds = identifiers(value.eligibleDepartmentIds);
  const dailyClaimLimit = nonNegativeInteger(value.dailyClaimLimit);
  const previousOwnerCooldownDays = nonNegativeInteger(value.previousOwnerCooldownDays);
  const customerPoolRules = rules(value.rules);
  if (
    id === null ||
    typeof value.name !== "string" ||
    value.name.trim().length === 0 ||
    !isStatus(value.status) ||
    version === null ||
    customerCount === null ||
    administratorActorIds === null ||
    eligibleActorIds === null ||
    eligibleDepartmentIds === null ||
    dailyClaimLimit === null ||
    previousOwnerCooldownDays === null ||
    customerPoolRules === null ||
    typeof value.automaticReleaseEnabled !== "boolean" ||
    typeof value.administrator !== "boolean"
  ) {
    return null;
  }

  return {
    id,
    name: value.name,
    status: value.status,
    version,
    customerCount,
    administratorActorIds,
    eligibleActorIds,
    eligibleDepartmentIds,
    dailyClaimLimit,
    previousOwnerCooldownDays,
    automaticReleaseEnabled: value.automaticReleaseEnabled,
    rules: customerPoolRules,
    administrator: value.administrator,
  };
}
