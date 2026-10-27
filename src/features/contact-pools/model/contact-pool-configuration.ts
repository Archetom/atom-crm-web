import type { ContactPoolStatus } from "./contact-pool-catalog";
import { recordOf } from "~/shared/utils/decode";

export type ContactPoolRuleType = "STALE_UPDATE" | "NOT_WON";

export interface ContactPoolRule {
  type: ContactPoolRuleType;
  inactiveDays: number;
}

export interface ContactPoolConfiguration {
  id: number;
  name: string;
  status: ContactPoolStatus;
  version: number;
  contactCount: number;
  administratorActorIds: readonly number[];
  eligibleActorIds: readonly number[];
  eligibleDepartmentIds: readonly number[];
  dailyClaimLimit: number;
  previousOwnerCooldownDays: number;
  automaticReleaseEnabled: boolean;
  rules: readonly ContactPoolRule[];
  administrator: boolean;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function identifiers(value: unknown): readonly number[] | null {
  if (!Array.isArray(value)) return null;

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

function isStatus(value: unknown): value is ContactPoolStatus {
  return value === "ACTIVE" || value === "INACTIVE" || value === "DELETED";
}

function isRuleType(value: unknown): value is ContactPoolRuleType {
  return value === "STALE_UPDATE" || value === "NOT_WON";
}

function rules(value: unknown): readonly ContactPoolRule[] | null {
  if (!Array.isArray(value) || value.length > 10) return null;

  const known = new Set<ContactPoolRuleType>();
  const result: ContactPoolRule[] = [];
  for (const candidate of value) {
    const rule = recordOf(candidate);
    const inactiveDays = rule === null ? null : nonNegativeInteger(rule.inactiveDays);
    if (
      rule === null ||
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

/** Narrow management projection because OpenAPI currently exposes only an untyped response. */
export function toContactPoolConfiguration(value: unknown): ContactPoolConfiguration | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const version = nonNegativeInteger(source.version);
  const contactCount = nonNegativeInteger(source.contactCount);
  const administratorActorIds = identifiers(source.administratorActorIds);
  const eligibleActorIds = identifiers(source.eligibleActorIds);
  const eligibleDepartmentIds = identifiers(source.eligibleDepartmentIds);
  const dailyClaimLimit = nonNegativeInteger(source.dailyClaimLimit);
  const previousOwnerCooldownDays = nonNegativeInteger(source.previousOwnerCooldownDays);
  const contactPoolRules = rules(source.rules);
  if (
    id === null ||
    typeof source.name !== "string" ||
    source.name.trim().length === 0 ||
    !isStatus(source.status) ||
    version === null ||
    contactCount === null ||
    administratorActorIds === null ||
    eligibleActorIds === null ||
    eligibleDepartmentIds === null ||
    dailyClaimLimit === null ||
    previousOwnerCooldownDays === null ||
    contactPoolRules === null ||
    typeof source.automaticReleaseEnabled !== "boolean" ||
    typeof source.administrator !== "boolean"
  ) {
    return null;
  }

  return {
    id,
    name: source.name,
    status: source.status,
    version,
    contactCount,
    administratorActorIds,
    eligibleActorIds,
    eligibleDepartmentIds,
    dailyClaimLimit,
    previousOwnerCooldownDays,
    automaticReleaseEnabled: source.automaticReleaseEnabled,
    rules: contactPoolRules,
    administrator: source.administrator,
  };
}
