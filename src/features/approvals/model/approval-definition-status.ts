import {
  approvalDefinitionStatuses,
  type ApprovalDefinitionStatus,
} from "./approval-definition-list-item";
import { recordOf } from "~/shared/utils/decode";

export interface ApprovalDefinitionStatusBaseline {
  id: number;
  status: ApprovalDefinitionStatus;
  version: number;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nonNegativeVersion(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isStatus(value: unknown): value is ApprovalDefinitionStatus {
  return typeof value === "string" && approvalDefinitionStatuses.some((status) => status === value);
}

/** Drops all definition routing configuration and retains only the status mutation baseline. */
export function toApprovalDefinitionStatusBaseline(
  value: unknown,
): ApprovalDefinitionStatusBaseline | null {
  const source = recordOf(value);
  const id = source === null ? null : positiveIdentifier(source.id);
  const version = source === null ? null : nonNegativeVersion(source.version);
  if (source === null || id === null || version === null || !isStatus(source.status)) return null;

  return { id, status: source.status, version };
}
