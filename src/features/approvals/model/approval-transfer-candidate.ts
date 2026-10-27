import { positiveInteger, recordOf } from "~/shared/utils/decode";

export interface ApprovalTransferCandidate {
  actorId: number;
  displayName: string;
}

export interface ApprovalTransferCandidatePage {
  candidates: ApprovalTransferCandidate[];
  total: number;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Keeps only the server-validated actor ID and display name used for an explicit transfer. */
export function toApprovalTransferCandidate(value: unknown): ApprovalTransferCandidate | null {
  const source = recordOf(value);
  const actorId = source === null ? null : positiveInteger(source.actorId);
  if (
    source === null ||
    actorId === null ||
    typeof source.displayName !== "string" ||
    source.displayName.trim().length === 0
  ) {
    return null;
  }

  return { actorId, displayName: source.displayName };
}

/** Rejects malformed pages rather than silently treating an incomplete transfer list as authoritative. */
export function toApprovalTransferCandidatePage(
  value: unknown,
): ApprovalTransferCandidatePage | null {
  const source = recordOf(value);
  const total = source === null ? null : nonNegativeInteger(source.totalNum);
  if (source === null || total === null || !Array.isArray(source.objectList)) return null;

  const candidates: ApprovalTransferCandidate[] = [];
  for (const value of source.objectList) {
    const candidate = toApprovalTransferCandidate(value);
    if (candidate === null) return null;
    candidates.push(candidate);
  }

  return { candidates, total };
}
