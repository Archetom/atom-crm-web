import { recordOf } from "~/shared/utils/decode";

export interface OpportunityPipelineOption {
  id: number;
  code: string;
  name: string;
}

export interface OpportunityPipelineStageOption {
  id: number;
  code: string;
  name: string;
}

function activeCatalogOptions(value: unknown): readonly Record<string, unknown>[] {
  const objectList = recordOf(value)?.objectList;
  if (!Array.isArray(objectList)) {
    throw new Error("销售管线目录数据暂时不可用，请稍后重试。");
  }

  return objectList.flatMap((item) => {
    const option = recordOf(item);
    return option?.status === "ACTIVE" ? [option] : [];
  });
}

function optionIdentity(value: Record<string, unknown>): OpportunityPipelineOption | null {
  const id = value.id;
  const code = value.code;
  const name = value.name;
  if (
    typeof id !== "number" ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    typeof code !== "string" ||
    code.trim().length === 0 ||
    typeof name !== "string" ||
    name.trim().length === 0
  ) {
    return null;
  }
  return { id, code, name };
}

/** Decodes the active, server-governed sales-pipeline choices. */
export function decodeOpportunityPipelineOptions(
  value: unknown,
): readonly OpportunityPipelineOption[] {
  const known = new Set<number>();
  return activeCatalogOptions(value).flatMap((item) => {
    const option = optionIdentity(item);
    if (option === null || known.has(option.id)) return [];
    known.add(option.id);
    return [option];
  });
}

/** Decodes the active, server-governed stage choices for one selected pipeline. */
export function decodeOpportunityPipelineStageOptions(
  value: unknown,
): readonly OpportunityPipelineStageOption[] {
  const known = new Set<number>();
  return activeCatalogOptions(value).flatMap((item) => {
    const option = optionIdentity(item);
    if (option === null || known.has(option.id)) return [];
    known.add(option.id);
    return [option];
  });
}
