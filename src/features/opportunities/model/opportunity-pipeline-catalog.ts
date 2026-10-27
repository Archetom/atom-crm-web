import { recordOf } from "~/shared/utils/decode";

export type OpportunityPipelineCatalogStatus = "ACTIVE" | "INACTIVE" | "DELETED";

export interface OpportunityPipelineCatalogItem {
  id: number;
  code: string;
  name: string;
  displayOrder: number;
  status: OpportunityPipelineCatalogStatus;
  version: number;
}

export interface OpportunityPipelineStageCatalogItem {
  id: number;
  pipelineCode: string;
  code: string;
  name: string;
  displayOrder: number;
  probability: number;
  status: OpportunityPipelineCatalogStatus;
  version: number;
}

function positiveIdentifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function integerInRange(value: unknown, maximum: number): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum
    ? value
    : null;
}

function catalogCode(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)
    ? value
    : null;
}

function catalogName(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function catalogStatus(value: unknown): OpportunityPipelineCatalogStatus | null {
  return value === "ACTIVE" || value === "INACTIVE" || value === "DELETED" ? value : null;
}

/** Decodes one server-governed sales pipeline with its optimistic-lock baseline. */
export function toOpportunityPipelineCatalogItem(
  value: unknown,
): OpportunityPipelineCatalogItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const code = catalogCode(source.code);
  const name = catalogName(source.name);
  const displayOrder = integerInRange(source.displayOrder, 1_000_000);
  const status = catalogStatus(source.status);
  const version = integerInRange(source.version, Number.MAX_SAFE_INTEGER);
  if (
    id === null ||
    code === null ||
    name === null ||
    displayOrder === null ||
    status === null ||
    version === null
  ) {
    return null;
  }

  return { id, code, name, displayOrder, status, version };
}

/** Decodes one server-governed sales stage with its optimistic-lock baseline. */
export function toOpportunityPipelineStageCatalogItem(
  value: unknown,
): OpportunityPipelineStageCatalogItem | null {
  const source = recordOf(value);
  if (source === null) return null;

  const id = positiveIdentifier(source.id);
  const pipelineCode = catalogCode(source.pipelineCode);
  const code = catalogCode(source.code);
  const name = catalogName(source.name);
  const displayOrder = integerInRange(source.displayOrder, 1_000_000);
  const probability = integerInRange(source.probability, 100);
  const status = catalogStatus(source.status);
  const version = integerInRange(source.version, Number.MAX_SAFE_INTEGER);
  if (
    id === null ||
    pipelineCode === null ||
    code === null ||
    name === null ||
    displayOrder === null ||
    probability === null ||
    status === null ||
    version === null
  ) {
    return null;
  }

  return { id, pipelineCode, code, name, displayOrder, probability, status, version };
}
