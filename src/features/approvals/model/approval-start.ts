import { nonBlankString, positiveInteger, recordOf } from "~/shared/utils/decode";

export interface ApprovalStartSelection {
  code: string;
  name: string;
}

export interface ApprovalStartOption {
  definitionId: number;
  name: string;
  selections: ApprovalStartSelection[];
}

export interface ApprovalStartOptions {
  objectType: string;
  options: ApprovalStartOption[];
  subjectId: number;
}

export interface ApprovalStartCandidate {
  actorId: number;
  displayName: string;
}

export interface ApprovalStartCandidatePage {
  candidates: ApprovalStartCandidate[];
  total: number;
}

export interface ApprovalRoutePreviewStep {
  name: string;
  selectionRequired: boolean;
}

export interface ApprovalRoutePreview {
  blockerCode: string | null;
  definitionId: number;
  executable: boolean;
  steps: ApprovalRoutePreviewStep[];
  subjectId: number;
}

function optionalNonBlankString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return nonBlankString(value) ?? undefined;
}

function toApprovalStartSelection(value: unknown): ApprovalStartSelection | null {
  const source = recordOf(value);
  const code = source === null ? null : nonBlankString(source.code);
  const name = source === null ? null : nonBlankString(source.name);
  return code === null || name === null ? null : { code, name };
}

function toApprovalStartOption(value: unknown): ApprovalStartOption | null {
  const source = recordOf(value);
  const definitionId = source === null ? null : positiveInteger(source.definitionId);
  const name = source === null ? null : nonBlankString(source.name);
  if (
    source === null ||
    definitionId === null ||
    name === null ||
    !Array.isArray(source.selections)
  ) {
    return null;
  }

  const selections: ApprovalStartSelection[] = [];
  for (const value of source.selections) {
    const selection = toApprovalStartSelection(value);
    if (selection === null || selections.some((item) => item.code === selection.code)) return null;
    selections.push(selection);
  }

  return { definitionId, name, selections };
}

/** Keeps only server-authorized definitions and their explicit approver selections. */
export function toApprovalStartOptions(value: unknown): ApprovalStartOptions | null {
  const source = recordOf(value);
  const objectType = source === null ? null : nonBlankString(source.objectType);
  const subjectId = source === null ? null : positiveInteger(source.subjectId);
  if (
    source === null ||
    objectType === null ||
    subjectId === null ||
    !Array.isArray(source.options)
  ) {
    return null;
  }

  const options: ApprovalStartOption[] = [];
  for (const value of source.options) {
    const option = toApprovalStartOption(value);
    if (option === null || options.some((item) => item.definitionId === option.definitionId))
      return null;
    options.push(option);
  }

  return { objectType, options, subjectId };
}

/** Keeps only the candidates validated by the selected record, definition, and selection. */
export function toApprovalStartCandidatePage(value: unknown): ApprovalStartCandidatePage | null {
  const source = recordOf(value);
  const total = source === null ? null : source.totalNum;
  if (
    source === null ||
    typeof total !== "number" ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !Array.isArray(source.objectList)
  ) {
    return null;
  }

  const candidates: ApprovalStartCandidate[] = [];
  for (const value of source.objectList) {
    const item = recordOf(value);
    const actorId = item === null ? null : positiveInteger(item.actorId);
    const displayName = item === null ? null : nonBlankString(item.displayName);
    if (
      actorId === null ||
      displayName === null ||
      candidates.some((candidate) => candidate.actorId === actorId)
    ) {
      return null;
    }
    candidates.push({ actorId, displayName });
  }

  return { candidates, total };
}

/** Drops route codes and all approval facts; the preview is only a startability confirmation. */
export function toApprovalRoutePreview(value: unknown): ApprovalRoutePreview | null {
  const source = recordOf(value);
  const definitionId = source === null ? null : positiveInteger(source.definitionId);
  const subjectId = source === null ? null : positiveInteger(source.subjectId);
  const blockerCode = source === null ? undefined : optionalNonBlankString(source.blockerCode);
  if (
    source === null ||
    definitionId === null ||
    subjectId === null ||
    blockerCode === undefined ||
    typeof source.executable !== "boolean" ||
    !Array.isArray(source.steps)
  ) {
    return null;
  }

  const steps: ApprovalRoutePreviewStep[] = [];
  for (const value of source.steps) {
    const step = recordOf(value);
    const name = step === null ? null : nonBlankString(step.name);
    if (name === null || typeof step?.selectionRequired !== "boolean") return null;
    steps.push({ name, selectionRequired: step.selectionRequired });
  }

  return { blockerCode, definitionId, executable: source.executable, steps, subjectId };
}
