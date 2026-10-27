import { nonBlankString, positiveInteger, recordOf } from "~/shared/utils/decode";

export interface StageWorkflowSummary {
  id: number;
  name: string;
  objectType: string;
  version: number;
}

export interface StageWorkflowSummaryPage {
  items: StageWorkflowSummary[];
  total: number | null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function pageTotal(value: unknown): number | null | undefined {
  if (value === -1) return null;
  return nonNegativeInteger(value) ?? undefined;
}

/** Drops workflow stages, applicability scopes, timestamps, status, and resource capabilities. */
export function toStageWorkflowSummary(value: unknown): StageWorkflowSummary | null {
  const source = recordOf(value);
  const id = source === null ? null : positiveInteger(source.id);
  const name = source === null ? null : nonBlankString(source.name);
  const objectType = source === null ? null : nonBlankString(source.objectType);
  const version = source === null ? null : nonNegativeInteger(source.version);
  if (id === null || name === null || objectType === null || version === null) return null;

  return { id, name, objectType, version };
}

/** Decodes a server-authorized workflow directory before it enters the Query cache. */
export function toStageWorkflowSummaryPage(value: unknown): StageWorkflowSummaryPage | null {
  const source = recordOf(value);
  const total = source === null ? undefined : pageTotal(source.totalNum);
  if (source === null || total === undefined || !Array.isArray(source.objectList)) return null;

  return {
    items: source.objectList.flatMap((value) => {
      const item = toStageWorkflowSummary(value);
      return item === null ? [] : [item];
    }),
    total,
  };
}
